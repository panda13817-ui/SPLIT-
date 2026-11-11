# Configuración de BAMBUZA SIGN en Supabase

Proyecto: https://supabase.com/dashboard/project/vzkglpkaxmsinicsarvq
URL pública del proyecto: https://vzkglpkaxmsinicsarvq.supabase.co
Administrador previsto: bambuzarecords@gmail.com

## 1. Crear las tablas y políticas
1. Abre el SQL Editor del proyecto.
2. Abre este repositorio y copia el contenido de `supabase/migrations/001_initial_schema.sql`.
3. Pega el SQL en una consulta nueva y pulsa Run.
4. Verifica en Table Editor que aparezcan: documents, participants, signing_requests y audit_events.
5. Verifica en Storage que exista el bucket privado `bambuza-private`.

## 2. Activar el acceso del administrador
1. En Authentication > Providers, confirma que Email esté habilitado.
2. En Authentication > Users, crea/invita `bambuzarecords@gmail.com` o usa el flujo de registro/invitación disponible.
3. Configura la URL de redirección autorizada cuando el frontend esté desplegado.
4. No habilites registro público para cualquier persona. El acceso de administración debe limitarse al correo autorizado.

## 3. Variables de entorno del frontend
Configurar en el hosting:
- `VITE_SUPABASE_URL=https://vzkglpkaxmsinicsarvq.supabase.co`
- `VITE_SUPABASE_ANON_KEY=<publishable/anon key del proyecto>`

La clave publishable/anon está diseñada para el cliente y queda protegida por RLS. Nunca colocar la clave `service_role` en el navegador, repositorio o variables VITE_.

## 4. Firma mediante enlaces
Los enlaces de firma pública NO deben consultar tablas directamente con la clave anon. Se implementarán con una Edge Function que valide un token aleatorio, almacene solo su hash, compruebe expiración y registre consentimiento, fecha y evidencia. La service_role solo se configura como secreto de la función.

## 5. Límites de esta primera migración
Esta migración crea la estructura privada y políticas de administración. No publica por sí sola la aplicación, no envía correos ni crea enlaces de firma. Antes de usar contratos reales se debe desplegar autenticación, Edge Functions, envío de correo y revisar el texto contractual con asesoría jurídica colombiana.
