using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Retira el tipo de regla «Restricción bloqueante» (RF-REG-005).
    ///
    /// <para><b>No cambia el esquema.</b> El tipo se persiste como texto, así que retirarlo es una
    /// decisión de comportamiento —el servidor ya no deja crear reglas de ese tipo y la pantalla no
    /// lo ofrece— más este paso, que se ocupa de los datos que pudiera haber.</para>
    ///
    /// <para><b>Por qué existe si no había ninguna.</b> En <c>db-gestia-dev</c> se contaron cero
    /// reglas de restricción, ni activas ni inactivas. Aun así la migración va, por dos razones:
    /// deja el retiro escrito en el historial del esquema, que es donde alguien lo va a buscar
    /// dentro de un año, y cubre cualquier base —otra organización, otro ambiente, un respaldo
    /// restaurado— donde sí las hubiera.</para>
    ///
    /// <para><b>Desactiva, no borra.</b> Una regla de restricción es un registro operativo: alguien
    /// la creó, y el principio 3 del proyecto dice que nada se elimina. Desactivada deja de
    /// evaluarse —el motor sólo mira las activas— y sigue consultable.</para>
    /// </summary>
    public partial class RetireBlockingRestrictionRuleType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                UPDATE dbo.EligibilityRequirements
                SET Active = 0,
                    UpdatedAt = SYSUTCDATETIME(),
                    UpdatedBy = '00000000-0000-0000-0000-000000000000',
                    UpdatedByName = N'Catalog migration'
                WHERE RequirementType = 'Restriction'
                  AND Active = 1;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Sólo se reactiva lo que esta migración desactivó, reconocible por el actor que lo
            // escribió. Una regla que alguien hubiera retirado a mano antes se queda retirada:
            // volver atrás el código no es motivo para deshacer la decisión de una persona.
            migrationBuilder.Sql(@"
                UPDATE dbo.EligibilityRequirements
                SET Active = 1
                WHERE RequirementType = 'Restriction'
                  AND Active = 0
                  AND UpdatedByName = N'Catalog migration';
            ");
        }
    }
}
