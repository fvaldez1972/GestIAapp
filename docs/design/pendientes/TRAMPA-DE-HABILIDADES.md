# La trampa de las habilidades

> **Prioridad: alta. Esto no es deuda, es una trampa.**
> Registrado el 7 de septiembre de 2026, durante la tanda de catálogos.
> Verificado en el código, no deducido de la documentación.

Hoy, en GestIA, **una regla de elegibilidad de tipo `Skill` se puede crear y no se puede
cumplir.** Quien la crea puede dejar una planeación imposible de publicar, y no existe ninguna
pantalla que permita deshacer el bloqueo salvo desactivando la propia regla.

## Por qué es peor que una funcionalidad faltante

Una funcionalidad faltante impide hacer algo. Esta impide **deshacer** algo que el sistema sí
dejó hacer. La diferencia importa: el usuario que cae en ella no está esperando una función
prometida, está atorado en una operación que ya empezó.

Y el momento en que aparece es el peor posible. La regla se crea en Catálogos, en calma. El
bloqueo se descubre al publicar la planeación de la semana, que es cuando ya no hay tiempo.

## La cadena completa, con evidencia

1. **Se puede crear la regla.** La pantalla de Catálogos permite dar de alta una regla de
   elegibilidad con `requirementType = 'Skill'`, apuntando por identificador a un valor del
   catálogo de habilidades, y marcarla como bloqueante (`isBlocking`).

2. **La regla se evalúa de verdad.** `CatalogService.EvaluateSkill` busca en las habilidades del
   empleado una fila activa cuyo `IdSkillCatalogItem` coincida con el
   `IdRequiredCatalogItem` de la regla y que no esté vencida. Si no la encuentra, devuelve
   `passed: false` con el mensaje «Falta habilidad requerida: …».

3. **Una regla bloqueante que no pasa detiene la publicación.**
   `SchedulingService`, al publicar una versión de planeación, recorre los turnos y lanza
   `ResourceConflictException`:

   ```csharp
   var reasons = eligibility.Reasons.Where(reason => reason.IsBlocking && !reason.Passed)...;
   throw new ResourceConflictException($"No se puede publicar: {eligibility.EmployeeName}. {...}");
   ```

   Lo mismo ocurre en `AssignmentService` al asignar y en `OperationsService` al operar.

4. **No hay forma de otorgar la habilidad.** El servidor sí tiene los endpoints
   (`CatalogEndpoints.cs`: listar, crear, actualizar y desactivar habilidades de un empleado) y el
   cliente Angular sí tiene los métodos (`catalog-api.service.ts`:
   `listEmployeeSkills`, `createEmployeeSkill`, `updateEmployeeSkill`,
   `deactivateEmployeeSkill`). **Ninguna pantalla los llama.** Una búsqueda de esos cuatro
   nombres en todo `frontend/src/app` sólo encuentra su propia definición.

El eslabón que falta es únicamente el último: la interfaz. Todo lo demás está construido y
funcionando, y por eso el bloqueo es real.

## Qué ve hoy quien cae en ella

Al publicar: *«No se puede publicar: Juan Pérez. Falta habilidad requerida: Manejo de arma
corta.»* El mensaje es correcto y no ayuda, porque nombra algo que el usuario no tiene manera de
darle a Juan Pérez desde ninguna pantalla.

La única salida disponible hoy es ir a Catálogos y **desactivar la regla**, que es exactamente lo
contrario de lo que la organización quería al crearla.

## Qué hay que hacer

Una pestaña de habilidades en el expediente del empleado, en la pantalla de Personal, que use los
cuatro métodos que ya existen. Con el selector de alta al vuelo (`gi-catalog-picker`) para que la
habilidad se pueda crear desde ahí mismo si falta del catálogo, y con la fecha de vencimiento
visible, porque la evaluación ya la respeta (`ExpiresDate`).

No requiere cambio de esquema: `EmployeeSkills` existe, tiene su configuración de Fluent API y
sus endpoints.

## Mientras tanto

Hasta que la pestaña exista, **crear una regla de elegibilidad de tipo `Skill` con
`isBlocking = true` deja la operación bloqueada**. Conviene decirlo en la propia pantalla de
Catálogos, junto a la casilla de bloqueo, antes de que alguien lo descubra un lunes por la
mañana.
