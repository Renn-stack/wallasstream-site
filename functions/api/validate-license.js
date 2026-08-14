// functions/api/validate-license.js
//
// Valida licencias de Lemon Squeezy sin exponer la API Key al cliente.
// Cloudflare Pages sirve este archivo en /api/validate-license.
//
// Portado desde la función serverless de Vercel que vivía en
// api/validate-license.js. La forma de la petición y de la respuesta se
// mantiene idéntica: la app de Mac ya publicada depende de ella, así que
// ninguna clave del JSON puede cambiar de nombre ni desaparecer.
//
// Diferencias con la versión de Vercel, todas de plataforma:
//   - las variables de entorno llegan en context.env, no en process.env
//   - el cuerpo se lee con request.json() en vez de req.body
//   - se devuelve un Response en vez de usar res.status().json()
//
// Uso desde la app Mac:
//
//   1) Activar (primera vez):
//      POST https://www.wallasstream.com/api/validate-license
//      Body: { "license_key": "XXXX", "instance_name": "Mac de Renata" }
//
//   2) Validar (arranques siguientes):
//      POST https://www.wallasstream.com/api/validate-license
//      Body: { "license_key": "XXXX", "instance_id": "abc-123", "action": "validate" }
//
//   3) Desactivar (al cambiar de Mac):
//      POST https://www.wallasstream.com/api/validate-license
//      Body: { "license_key": "XXXX", "instance_id": "abc-123", "action": "deactivate" }
//
// Secrets requeridos en Cloudflare Pages (Settings > Variables and Secrets),
// y hay que definirlos tanto en Production como en Preview:
//   - LEMON_SQUEEZY_API_KEY        (API key de Lemon Squeezy)
//   - LEMON_SQUEEZY_STORE_ID       (329547)
//   - LEMON_SQUEEZY_PRODUCT_ID     (997040 en test, cambiará en live)

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' }
    });
}

export async function onRequest(context) {
    const { request, env } = context;

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: CORS });
    }

    if (request.method !== 'POST') {
        return json({
            valid: false,
            error: 'Method not allowed. Use POST.'
        }, 405);
    }

    try {
        // Un cuerpo ausente o mal formado no debe tumbar la función con un
        // 500 genérico: se trata como falta la license_key, igual que antes.
        let payload;
        try {
            payload = await request.json();
        } catch {
            payload = {};
        }

        const { license_key, instance_name, instance_id, action } = payload || {};

        // Validar input
        if (!license_key || typeof license_key !== 'string') {
            return json({
                valid: false,
                error: 'License key is required.'
            }, 400);
        }

        // Config desde variables de entorno
        const LEMON_API_KEY = env.LEMON_SQUEEZY_API_KEY;
        const EXPECTED_STORE_ID = env.LEMON_SQUEEZY_STORE_ID;
        const EXPECTED_PRODUCT_ID = env.LEMON_SQUEEZY_PRODUCT_ID;

        if (!LEMON_API_KEY) {
            console.error('LEMON_SQUEEZY_API_KEY not configured');
            return json({
                valid: false,
                error: 'Server configuration error.'
            }, 500);
        }

        if (!EXPECTED_STORE_ID || !EXPECTED_PRODUCT_ID) {
            console.error('LEMON_SQUEEZY_STORE_ID or LEMON_SQUEEZY_PRODUCT_ID not configured');
            return json({
                valid: false,
                error: 'Server configuration error.'
            }, 500);
        }

        // Decidir endpoint según action
        // default = activate (primera vez)
        let endpoint = 'https://api.lemonsqueezy.com/v1/licenses/activate';
        if (action === 'validate') {
            endpoint = 'https://api.lemonsqueezy.com/v1/licenses/validate';
        } else if (action === 'deactivate') {
            endpoint = 'https://api.lemonsqueezy.com/v1/licenses/deactivate';
        }

        // Preparar el body según la acción
        const body = new URLSearchParams();
        body.append('license_key', license_key);

        if (!action || action === 'activate') {
            // Activación: requiere instance_name
            body.append('instance_name', instance_name || 'Wallas Stream Mac');
        } else if (action === 'validate' || action === 'deactivate') {
            // Validación / desactivación: requiere instance_id
            if (!instance_id) {
                return json({
                    valid: false,
                    error: 'instance_id is required for validate/deactivate.'
                }, 400);
            }
            body.append('instance_id', instance_id);
        }

        // Llamar a Lemon Squeezy
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Bearer ${LEMON_API_KEY}`
            },
            body: body.toString()
        });

        const data = await response.json();

        // Si Lemon Squeezy devuelve error
        if (!response.ok || data.error) {
            return json({
                valid: false,
                error: data.error || 'License validation failed.'
            });
        }

        // VERIFICACIÓN CRÍTICA: la licencia pertenece a ESTE producto.
        // Protege contra uso de licencias de otros productos Lemon Squeezy.
        const meta = data.meta || {};
        const storeId = String(meta.store_id || '');
        const productId = String(meta.product_id || '');

        if (storeId !== String(EXPECTED_STORE_ID)) {
            console.warn(`Store ID mismatch: got ${storeId}, expected ${EXPECTED_STORE_ID}`);
            return json({
                valid: false,
                error: 'This license does not belong to Wallas\' Stream.'
            });
        }

        if (productId !== String(EXPECTED_PRODUCT_ID)) {
            console.warn(`Product ID mismatch: got ${productId}, expected ${EXPECTED_PRODUCT_ID}`);
            return json({
                valid: false,
                error: 'This license is not for Wallas\' Stream Pro.'
            });
        }

        // Determinar si la respuesta es válida según el endpoint usado
        const isValid =
            data.valid === true ||        // validate
            data.activated === true ||    // activate
            data.deactivated === true;    // deactivate

        // Respuesta exitosa
        return json({
            valid: isValid,
            activated: data.activated || false,
            deactivated: data.deactivated || false,
            instance_id: data.instance?.id || null,
            license_key_status: data.license_key?.status || null,
            activation_limit: data.license_key?.activation_limit || null,
            activation_usage: data.license_key?.activation_usage || null,
            expires_at: data.license_key?.expires_at || null,
            customer_name: meta.customer_name || null,
            customer_email: meta.customer_email || null,
            product_name: meta.product_name || null
        });

    } catch (error) {
        console.error('License validation error:', error);
        return json({
            valid: false,
            error: 'Internal server error. Please try again.'
        }, 500);
    }
}
