// worker/validate-license.js
//
// Valida licencias de Lemon Squeezy sin exponer la API Key al cliente.
//
// PORTADO DESDE functions/api/validate-license.js, que era una Pages
// Function. Un Worker con static assets no ejecuta el directorio functions/:
// esa convención es exclusiva de Pages. El handler vive ahora aquí y lo
// invoca worker/index.js cuando la ruta es /api/validate-license.
//
// LA FORMA DE LA PETICIÓN Y DE LA RESPUESTA NO CAMBIA. La app de Mac ya
// publicada depende de ella, así que ninguna clave del JSON puede cambiar de
// nombre ni desaparecer. Lo único que cambió respecto de la Pages Function es
// la firma: recibe (request, env) en vez de un context, porque en un Worker
// los bindings llegan como segundo argumento del fetch handler.
//
// Uso desde la app Mac:
//
//   1) Activar (primera vez):
//      POST https://www.wallasstream.com/api/validate-license
//      Body: { "license_key": "XXXX", "instance_name": "Mac de Renata" }
//
//   2) Validar (arranques siguientes):
//      Body: { "license_key": "XXXX", "instance_id": "abc-123", "action": "validate" }
//
//   3) Desactivar (al cambiar de Mac):
//      Body: { "license_key": "XXXX", "instance_id": "abc-123", "action": "deactivate" }
//
// Secrets requeridos, ahora del Worker y no de Pages:
//   npx wrangler secret put LEMON_SQUEEZY_API_KEY
//   npx wrangler secret put LEMON_SQUEEZY_STORE_ID
//   npx wrangler secret put LEMON_SQUEEZY_PRODUCT_IDS
//
// LEMON_SQUEEZY_PRODUCT_IDS ES UNA LISTA separada por comas, no un solo id.
// El producto se vende como dos productos distintos en Lemon Squeezy, uno por
// idioma, y ambos dan derecho a la misma app:
//
//   997040,1265170        (997040 = English, 1265170 = Spanish)
//
// Sustituye a LEMON_SQUEEZY_PRODUCT_ID, en singular. Ese secret ya no se lee:
// si sigue definido en el Worker no hace nada, y si es el único que existe la
// función responde 500 de configuración en vez de validar contra un producto
// que nadie configuró.

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

export async function validateLicense(request, env) {
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

        // Config desde los secrets del Worker
        const LEMON_API_KEY = env.LEMON_SQUEEZY_API_KEY;
        const EXPECTED_STORE_ID = env.LEMON_SQUEEZY_STORE_ID;

        // Lista, no valor único. Se recorta cada id porque "997040, 1265170"
        // escrito con el espacio de después de la coma es lo natural al pegarlo
        // en el prompt de `wrangler secret put`, y un id con espacio delante
        // nunca casaría. Los vacíos se descartan, así que una coma suelta o
        // final no crea un id "" que haría match con una respuesta sin
        // product_id.
        const EXPECTED_PRODUCT_IDS = String(env.LEMON_SQUEEZY_PRODUCT_IDS || '')
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean);

        if (!LEMON_API_KEY) {
            console.error('LEMON_SQUEEZY_API_KEY not configured');
            return json({
                valid: false,
                error: 'Server configuration error.'
            }, 500);
        }

        // Una lista vacía tiene que ser un error de configuración, NO una lista
        // contra la que no casa nada. Si se colara como lista vacía, toda
        // licencia legítima sería rechazada con "no es de Wallas' Stream Pro" y
        // el fallo parecería del cliente en vez de del despliegue.
        if (!EXPECTED_STORE_ID || EXPECTED_PRODUCT_IDS.length === 0) {
            console.error('LEMON_SQUEEZY_STORE_ID or LEMON_SQUEEZY_PRODUCT_IDS not configured');
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

        // Basta con que coincida con UNO. Las ediciones en inglés y en español
        // son productos separados en Lemon Squeezy y las dos dan derecho a la
        // misma app, así que la comparación pasa de igualdad a pertenencia.
        // productId ya viene por String(), y una respuesta sin product_id queda
        // en '', que no está en la lista: se rechaza, igual que antes.
        if (!EXPECTED_PRODUCT_IDS.includes(productId)) {
            console.warn(`Product ID mismatch: got ${productId}, expected one of ${EXPECTED_PRODUCT_IDS.join(', ')}`);
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
