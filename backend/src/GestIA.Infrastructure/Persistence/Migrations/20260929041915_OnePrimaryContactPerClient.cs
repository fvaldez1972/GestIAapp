using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Un solo contacto principal por cliente.
    ///
    /// <para>La regla no existía en ninguna capa: la marca sólo servía para ordenar la lista, y por
    /// eso se podían poner dos. Se agrega donde se puede comprobar de verdad —el servicio, que
    /// además nombra a quien ya la tiene, y este índice— y de paso se limpia lo que ya estaba.</para>
    ///
    /// <para>El índice se crea <b>después</b> de la limpieza a propósito: con dos principales en el
    /// mismo cliente, crearlo primero fallaría y dejaría la migración a medias.</para>
    /// </summary>
    public partial class OnePrimaryContactPerClient : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(UnSoloPrincipal);

            migrationBuilder.CreateIndex(
                name: "UX_ClientContacts_IdClient",
                schema: "dbo",
                table: "ClientContacts",
                column: "IdClient",
                unique: true,
                filter: "[IsPrimary] = 1 AND [Active] = 1");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Las marcas que se bajaron no se devuelven: no hay forma de distinguirlas de las que
            // ya estaban bajas, y volver a subirlas recrearia el defecto que esto vino a corregir.
            migrationBuilder.DropIndex(
                name: "UX_ClientContacts_IdClient",
                schema: "dbo",
                table: "ClientContacts");
        }

        /// <summary>
        /// Deja un principal por cliente —el más antiguo— y comprueba que quedó así.
        /// </summary>
        private const string UnSoloPrincipal = """
            SET NOCOUNT ON;

            -- Se conserva el mas antiguo de cada cliente y se le baja la marca al resto.
            --
            -- El mas antiguo y no el mas reciente porque es el que lleva tiempo siendo el contacto
            -- de ese cliente: el segundo aparecio despues, sin que nadie quitara al primero, que es
            -- justamente el defecto. El desempate por identificador existe para que dos contactos
            -- creados en el mismo segundo no dejen el resultado al azar.
            WITH Ordenados AS (
                SELECT
                    IdClientContact,
                    ROW_NUMBER() OVER (
                        PARTITION BY IdClient
                        ORDER BY CreatedAt, IdClientContact) AS Orden
                FROM dbo.ClientContacts
                WHERE Active = 1 AND IsPrimary = 1
            )
            UPDATE c
            SET c.IsPrimary = 0,
                c.UpdatedAt = SYSUTCDATETIME(),
                c.UpdatedBy = c.CreatedBy,
                c.UpdatedByName = N'Migracion: un solo contacto principal por cliente'
            FROM dbo.ClientContacts AS c
            JOIN Ordenados AS o ON o.IdClientContact = c.IdClientContact
            WHERE o.Orden > 1;

            -- Comprobacion 1: ningun cliente conserva dos principales activos.
            IF EXISTS (
                SELECT 1
                FROM dbo.ClientContacts
                WHERE Active = 1 AND IsPrimary = 1
                GROUP BY IdClient
                HAVING COUNT(*) > 1)
            BEGIN
                THROW 50020, 'RQ-05: algun cliente sigue con mas de un contacto principal activo. La migracion se detuvo.', 1;
            END;

            -- Comprobacion 2: no se perdio ningun cliente por el camino. Quien tenia principal
            -- antes tiene que seguir teniendo exactamente uno; bajar de dos a cero seria un error
            -- de la consulta de arriba, y se veria como un cliente sin contacto principal.
            IF EXISTS (
                SELECT 1
                FROM dbo.ClientContacts
                WHERE Active = 1
                GROUP BY IdClient
                HAVING SUM(CASE WHEN IsPrimary = 1 THEN 1 ELSE 0 END) = 0
                   AND MAX(CASE WHEN UpdatedByName = N'Migracion: un solo contacto principal por cliente' THEN 1 ELSE 0 END) = 1)
            BEGIN
                THROW 50021, 'RQ-05: algun cliente quedo sin contacto principal despues de la limpieza. La migracion se detuvo.', 1;
            END;
            """;
    }
}
