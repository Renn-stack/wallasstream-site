// /api/validate-license.js
//
// Endpoint serverless que valida licencias de Lemon Squeezy
// de forma segura sin exponer la API Key al cliente.
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
// Variables de entorno requeridas en Vercel:
//   - LEMON_SQUEEZY_API_KEY        (tu API key de Lemon Squeezy)
//   - LEMON_SQUEEZY_STORE_ID       (329547)
//   - LEMON_SQUEEZY_PRODUCT_ID     (997040 en test, cambiará en live)

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({
            valid: false,
            error: 'Method not allowed. Use POST.'
        });
    }

    try {
        const { license_key, instance_name, instance_id, action } = req.body;

        // Validar input
        if (!license_key || typeof license_key !== 'string') {
            return res.status(400).json({
                valid: false,
                error: 'License key is required.'
            });
        }

        // Config desde variables de entorno
        const LEMON_API_KEY = process.env.LEMON_SQUEEZY_API_KEY;
        const EXPECTED_STORE_ID = process.env.LEMON_SQUEEZY_STORE_ID;
        const EXPECTED_PRODUCT_ID = process.env.LEMON_SQUEEZY_PRODUCT_ID;

        if (!LEMON_API_KEY) {
            console.error('LEMON_SQUEEZY_API_KEY not configured');
            return res.status(500).json({
                valid: false,
                error: 'Server configuration error.'
            });
        }

        if (!EXPECTED_STORE_ID || !EXPECTED_PRODUCT_ID) {
            console.error('LEMON_SQUEEZY_STORE_ID or LEMON_SQUEEZY_PRODUCT_ID not configured');
            return res.status(500).json({
                valid: false,
                error: 'Server configuration error.'
            });
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
                return res.status(400).json({
                    valid: false,
                    error: 'instance_id is required for validate/deactivate.'
                });
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
            return res.status(200).json({
                valid: false,
                error: data.error || 'License validation failed.'
            });
        }

        // 🔒 VERIFICACIÓN CRÍTICA: la licencia pertenece a ESTE producto
        // Protege contra uso de licencias de otros productos Lemon Squeezy
        const meta = data.meta || {};
        const storeId = String(meta.store_id || '');
        const productId = String(meta.product_id || '');

        if (storeId !== String(EXPECTED_STORE_ID)) {
            console.warn(`Store ID mismatch: got ${storeId}, expected ${EXPECTED_STORE_ID}`);
            return res.status(200).json({
                valid: false,
                error: 'This license does not belong to Wallas\' Stream.'
            });
        }

        if (productId !== String(EXPECTED_PRODUCT_ID)) {
            console.warn(`Product ID mismatch: got ${productId}, expected ${EXPECTED_PRODUCT_ID}`);
            return res.status(200).json({
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
        return res.status(200).json({
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
        return res.status(500).json({
            valid: false,
            error: 'Internal server error. Please try again.'
        });
    }
}
