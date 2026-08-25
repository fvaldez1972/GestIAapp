# Contexto del sistema

## Objetivo

GestIA centraliza la planeación y ejecución operativa de empresas de seguridad privada. El núcleo inicial cubre cliente, servicio, personal, posiciones, planeación, asistencia, incidencias, coberturas, tablero y reportes básicos.

## Actores iniciales

| Actor | Responsabilidad | Información permitida |
| --- | --- | --- |
| Dirección | Indicadores, auditoría y decisiones críticas | Todo según facultades |
| Comercial | Clientes, solicitudes y condiciones del servicio | Sin expediente sensible del empleado |
| Recursos Humanos | Personal, perfiles, disponibilidad y estatus | Sin modificar ejecución cerrada |
| Operaciones | Planeación, asistencia, incidencias y cobertura | Sin salarios o datos financieros sensibles |
| Supervisor | Ejecución de su zona y evidencia | Sin otras zonas ni información financiera |
| Cliente | Reportes de su propio servicio | Sin otros clientes ni expedientes completos |

## Sistemas externos futuros

- Proveedor de identidad corporativa.
- CONTPAQi u otro sistema fiscal/contable.
- Almacenamiento de documentos.
- Canales de captura móvil o WhatsApp.
- Portales de clientes.
- Timbrado, bancos y plataformas de cumplimiento.

Ninguna integración futura debe incorporarse al núcleo como dependencia directa. Application define puertos; Infrastructure implementa adaptadores.

## Despliegue lógico

```text
Navegador
  -> Angular SPA
    -> HTTPS / REST / OpenAPI
      -> ASP.NET Core API
        -> módulos de aplicación
          -> dominio
        -> infraestructura
          -> base de datos
          -> almacenamiento / integraciones futuras
```

## Límites de la primera etapa

Incluido:

- Multiempresa desde el modelo, aunque la primera demo use una empresa.
- Catálogos, solicitudes, servicios, posiciones y personal.
- Planeación versionada.
- Asistencia confirmada por excepción.
- Incidencias y cobertura consistente.
- Auditoría, concurrencia y trazabilidad.
- Dashboard y reportes básicos.

Posterior:

- Prenómina y conceptos económicos.
- Autorizaciones económicas completas.
- REPSE documental formal.
- Facturación, pagos e integraciones.
- Geocerca, fotografía y aplicación móvil.
- Inteligencia artificial.
