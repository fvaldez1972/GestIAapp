# Tanda de catálogos — aprobada, pendiente de ejecutar

> **Ejecutada el 7 de septiembre de 2026, salvo la pantalla.** Estado real y decisiones tomadas:
> [`../../ESTADO-TANDA-CATALOGOS-2026-09-07.md`](../../ESTADO-TANDA-CATALOGOS-2026-09-07.md).
>
> Lo que este documento dice quedó desactualizado en dos puntos, y conviene no leerlo al revés:
> el **punto 2 se invirtió** —el `Code` sí se fue, completo—, y el **punto 1 sí se hizo**, aunque
> aquí figuraba como pendiente separado. Lo único que queda vivo de esta lista es rehacer la
> pantalla.

Aprobada el 6 de septiembre de 2026, después del diagnóstico de catálogos. Se ejecuta cuando
terminen las pantallas de operación. **El punto 5 lleva plan aparte**, porque es el único con
migración y relleno de datos.

---

## 1. Quitar `Group` y `Synonyms`

Los dos campos existen en `BusinessCatalogItem` y ninguna pantalla ni consulta los usa.

## 2. El `Code` se queda

Es el identificador visible del elemento de catálogo y participa en la unicidad por tipo. No se
toca.

## 3. `Order` se queda por ahora

Pendiente de la reunión con Óscar y Joab: si el orden de presentación acaba siendo una decisión
del catálogo y no de la pantalla, se queda; si no, se retira en su propia tanda.

## 4. Retirar los seis catálogos que nadie lee

> **Enmienda del 6 de septiembre de 2026, al retirar el camino de configuración de Inicio.**
>
> Este punto empezaba por «sacar `Zone` del paso 1 de Inicio». **Ese sub-paso ya no tiene objeto:
> el paso 1 no existe.** Con el camino se fue el bloque entero, y con él la única pantalla que leía
> los conteos de catálogos.
>
> La consecuencia **refuerza** el retiro en lugar de debilitarlo. El conteo de `zones` se quedó sin
> ningún consumidor en el frontend: `OverviewSetupCounts` desapareció del contrato y
> `CountCatalogsAsync` se borró del repositorio, así que ya nadie cuenta zonas para nada. Un
> catálogo que nadie lee y cuyo conteo nadie mira no tiene ni siquiera el argumento de «pero sale
> en Inicio».
>
> Lo que sí cambia es el orden de trabajo: ya no hay que desenganchar `Zone` de ninguna pantalla
> antes de retirarlo. Se puede ir directo a comprobar que ninguna entidad lo referencie y, si es
> así, retirarlo.

Los seis se retiran comprobando primero, uno por uno, que ninguna entidad los referencie por
identificador. Un catálogo referenciado no se retira aunque su pantalla no lo lea: la referencia es
el dato, la pantalla es sólo la vista.

## 5. La geografía a su propia tabla — **plan aparte**

País → estado → municipio → **colonia**, en cascada completa, en una tabla propia y
**agnóstica de organización**: la geografía de México no pertenece a ninguna empresa. Se rellena
con SEPOMEX.

Es el punto más grande de la tanda y el único que lleva **migración con relleno**. Cuando llegue su
turno se escribe su propio plan antes de tocar nada, con la estrategia de migración de lo que hoy
vive como elementos de catálogo.
