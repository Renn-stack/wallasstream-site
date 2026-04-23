// /api/validate-license.js
//
// Endpoint serverless que valida licencias de Lemon Squeezy
// de forma segura sin exponer la API Key al cliente.
//
// Uso desde la app Mac:
//   POST https://www.wallasstream.com/api/validate-license
//   Body: { "license_key": "XXXX-XXXX-XXXX", "instance_name": "Mac de Renata" }
//
// Respuesta exitosa:
//   { "valid": true, "activated": true, "instance_id": "...", "activation_limit": 2, "activation_usage": 1 }
//
// Respuesta de error:
//   { "valid": false, "error": "..." }

export default async function handler(req, res) {
    // Solo aceptar POST
    if (req.method !== 'POST') {
        return res.status(405).json({
            valid: false,
            error: 'Method not allowed. Use POST.'
        });
    }

    // CORS headers (permite llamadas desde la app Mac)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { license_key, instance_name, action } = req.body;

        // Validar input
        if (!license_key || typeof license_key !== 'string') {
            return res.status(400).json({
                valid: false,
                error: 'License key is required.'
            });
        }

        // Obtener la API Key desde las variables de entorno de Vercel
        // (NUNCA hardcodear aquí)
        const LEMON_API_KEY = process.env.LEMON_SQUEEZY_API_KEY;

        if (!LEMON_API_KEY) {
            console.error('LEMON_SQUEEZY_API_KEY not configured');
            return res.status(500).json({
                valid: false,
                error: 'Server configuration error.'
            });
        }

        // Por defecto, activar la licencia (primera validación)
        const endpoint = action === 'validate'
            ? 'https://api.lemonsqueezy.com/v1/licenses/validate'
            : 'https://api.lemonsqueezy.com/v1/licenses/activate';

        // Preparar el body según la acción
        const body = new URLSearchParams();
        body.append('license_key', license_key);

        if (action !== 'validate') {
            // Activación: requiere instance_name
            body.append('instance_name', instance_name || 'Wallas Stream Mac');
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

        // Respuesta exitosa
        return res.status(200).json({
            valid: data.valid === true || data.activated === true,
            activated: data.activated || false,
            instance_id: data.instance?.id || null,
            license_key_status: data.license_key?.status || null,
            activation_limit: data.license_key?.activation_limit || null,
            activation_usage: data.license_key?.activation_usage || null,
            expires_at: data.license_key?.expires_at || null,
            customer_name: data.meta?.customer_name || null,
            customer_email: data.meta?.customer_email || null,
            product_name: data.meta?.product_name || null
        });

    } catch (error) {
        console.error('License validation error:', error);
        return res.status(500).json({
            valid: false,
            error: 'Internal server error. Please try again.'
        });
    }
}
