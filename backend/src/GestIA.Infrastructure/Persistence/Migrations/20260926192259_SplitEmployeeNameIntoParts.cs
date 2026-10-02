using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// RQ-06 · El nombre del personal pasa de un campo a tres: nombre(s), apellido paterno y
    /// apellido materno.
    ///
    /// <para><b>El nombre completo no desaparece.</b> Se conserva como columna derivada porque la
    /// busqueda, el orden alfabetico, las listas y los selectores van contra ella —158 puntos del
    /// servidor y 78 del navegador—, y porque «buscar por cualquiera de las tres partes» sale
    /// gratis mientras exista: las contiene todas. Lo que cambia es quien la llena: desde ahora la
    /// compone el dominio, y nadie la teclea.</para>
    ///
    /// <para><b>Por que en tres pasos y no en uno.</b> Las columnas nacen nullable, se reparten los
    /// datos vivos, y solo entonces las dos obligatorias pasan a NOT NULL. El paso de cierre lleva
    /// tres comprobaciones que detienen la migracion completa si el reparto no cuadro: ninguna parte
    /// mas larga que su columna, el nombre rearmado igual al original normalizado, y ninguna parte
    /// obligatoria vacia. Fallar aqui deja la base como estaba, que es preferible a dejarla a
    /// medias.</para>
    ///
    /// <para><b>Lo que esta migracion no hace.</b> No toca la auditoria ni escribe historial. El
    /// reparto no es la correccion de un dato por parte de una persona: es el mismo nombre guardado
    /// de otra forma, y el valor anterior queda en FullName recompuesto. Tampoco corrige los casos
    /// dudosos: los deja repartidos segun la regla y localizables para repasarlos a mano.</para>
    /// </summary>
    public partial class SplitEmployeeNameIntoParts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 250 = 80 x 3 + 2 espacios, con holgura. Antes eran 200 y se capturaba a mano; ahora es
            // un derivado cuyo tope lo fija la suma de las partes.
            migrationBuilder.AlterColumn<string>(
                name: "FullName",
                schema: "dbo",
                table: "Employees",
                type: "nvarchar(250)",
                maxLength: 250,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(200)",
                oldMaxLength: 200);

            // Paso 1: aditivo. Las tres nacen nullable para que el reparto tenga donde escribir.
            migrationBuilder.AddColumn<string>(
                name: "FirstName",
                schema: "dbo",
                table: "Employees",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastNamePaternal",
                schema: "dbo",
                table: "Employees",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastNameMaternal",
                schema: "dbo",
                table: "Employees",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);

            // Paso 2: reparto de los datos vivos y comprobaciones de cierre.
            migrationBuilder.Sql(RepartoDeNombres);

            // Paso 3: las dos partes obligatorias lo son tambien en la base.
            migrationBuilder.AlterColumn<string>(
                name: "FirstName",
                schema: "dbo",
                table: "Employees",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(80)",
                oldMaxLength: 80,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "LastNamePaternal",
                schema: "dbo",
                table: "Employees",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(80)",
                oldMaxLength: 80,
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Volver atras es posible porque FullName nunca se perdio: quedo recompuesto de las
            // partes. Lo unico que no se recupera es el espacio doble de una fila que lo tuviera, y
            // las palabras «(sin apellido)» que se anadieron a quien no tenia ninguno.
            migrationBuilder.DropColumn(name: "FirstName", schema: "dbo", table: "Employees");
            migrationBuilder.DropColumn(name: "LastNamePaternal", schema: "dbo", table: "Employees");
            migrationBuilder.DropColumn(name: "LastNameMaternal", schema: "dbo", table: "Employees");

            migrationBuilder.AlterColumn<string>(
                name: "FullName",
                schema: "dbo",
                table: "Employees",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(250)",
                oldMaxLength: 250);
        }

        /// <summary>
        /// La regla de reparto, en SQL porque es aqui donde se aplica, una sola vez.
        ///
        /// <para><b>Se toman las dos ultimas partes como apellidos, no las dos primeras.</b> En
        /// Mexico el nombre compuesto («Jose Luis Perez Garcia») es mucho mas frecuente que el
        /// apellido compuesto, asi que esta eleccion acierta en el caso comun y falla en el raro; al
        /// reves fallaria en el comun.</para>
        ///
        /// <para><b>Las particulas se pegan al apellido que les sigue</b> antes de contar: «de»,
        /// «del», «la», «las», «los», «van», «von» y «y». Sin esto «Ana Perez de la Cruz» quedaria
        /// como Ana Perez · de · Cruz.</para>
        ///
        /// <para><b>Una sola palabra no se puede repartir</b> y el apellido paterno es obligatorio:
        /// se llena con «(sin apellido)». Esa fila queda localizable —es el unico valor con
        /// parentesis— para repasarla a mano. No se desactiva: una fila inactiva sigue existiendo y
        /// la columna sigue siendo NOT NULL, asi que desactivar no ahorraria el relleno.</para>
        /// </summary>
        private const string RepartoDeNombres = """
            SET NOCOUNT ON;

            DECLARE @SinApellido nvarchar(80) = N'(sin apellido)';

            -- El truco de los tres REPLACE convierte cualquier racha de espacios en uno solo sin
            -- recorrer la cadena. Se cuenta sobre el nombre ya colapsado.
            CREATE TABLE #Reparto
            (
                IdEmployee uniqueidentifier NOT NULL PRIMARY KEY,
                Original nvarchar(250) NOT NULL,
                Normalizado nvarchar(250) NOT NULL,
                FirstName nvarchar(250) NULL,
                LastNamePaternal nvarchar(250) NULL,
                LastNameMaternal nvarchar(250) NULL
            );

            INSERT INTO #Reparto (IdEmployee, Original, Normalizado)
            SELECT
                IdEmployee,
                FullName,
                LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(FullName, N' ', N'<|>'), N'>|<', N''), N'<|>', N' ')))
            FROM dbo.Employees
            WHERE FirstName IS NULL;

            DECLARE @IdEmployee uniqueidentifier;
            DECLARE @Resto nvarchar(250);
            DECLARE @Token1 nvarchar(250);
            DECLARE @Token2 nvarchar(250);
            DECLARE @Palabra nvarchar(250);
            DECLARE @Corte int;
            DECLARE @Particula bit;

            DECLARE Filas CURSOR LOCAL FAST_FORWARD FOR
                SELECT IdEmployee, Normalizado FROM #Reparto;

            OPEN Filas;
            FETCH NEXT FROM Filas INTO @IdEmployee, @Resto;

            WHILE @@FETCH_STATUS = 0
            BEGIN
                SET @Token1 = NULL;
                SET @Token2 = NULL;

                -- Primer token desde la derecha, con sus particulas pegadas.
                SET @Corte = CHARINDEX(N' ', REVERSE(@Resto));
                IF @Corte = 0
                BEGIN
                    SET @Token1 = @Resto;
                    SET @Resto = N'';
                END
                ELSE
                BEGIN
                    SET @Token1 = RIGHT(@Resto, @Corte - 1);
                    SET @Resto = LEFT(@Resto, LEN(@Resto) - @Corte);

                    SET @Particula = 1;
                    WHILE @Particula = 1 AND @Resto <> N''
                    BEGIN
                        SET @Corte = CHARINDEX(N' ', REVERSE(@Resto));
                        SET @Palabra = CASE WHEN @Corte = 0 THEN @Resto ELSE RIGHT(@Resto, @Corte - 1) END;

                        IF LOWER(@Palabra) IN (N'de', N'del', N'la', N'las', N'los', N'van', N'von', N'y')
                        BEGIN
                            SET @Token1 = @Palabra + N' ' + @Token1;
                            SET @Resto = CASE WHEN @Corte = 0 THEN N'' ELSE LEFT(@Resto, LEN(@Resto) - @Corte) END;
                        END
                        ELSE
                        BEGIN
                            SET @Particula = 0;
                        END
                    END
                END

                IF @Resto = N''
                BEGIN
                    -- Una sola palabra: no hay apellido que repartir.
                    UPDATE #Reparto
                    SET FirstName = @Token1,
                        LastNamePaternal = @SinApellido,
                        LastNameMaternal = NULL
                    WHERE IdEmployee = @IdEmployee;
                END
                ELSE
                BEGIN
                    -- Segundo token desde la derecha, con el mismo trato de particulas.
                    SET @Corte = CHARINDEX(N' ', REVERSE(@Resto));
                    IF @Corte = 0
                    BEGIN
                        SET @Token2 = @Resto;
                        SET @Resto = N'';
                    END
                    ELSE
                    BEGIN
                        SET @Token2 = RIGHT(@Resto, @Corte - 1);
                        SET @Resto = LEFT(@Resto, LEN(@Resto) - @Corte);

                        SET @Particula = 1;
                        WHILE @Particula = 1 AND @Resto <> N''
                        BEGIN
                            SET @Corte = CHARINDEX(N' ', REVERSE(@Resto));
                            SET @Palabra = CASE WHEN @Corte = 0 THEN @Resto ELSE RIGHT(@Resto, @Corte - 1) END;

                            IF LOWER(@Palabra) IN (N'de', N'del', N'la', N'las', N'los', N'van', N'von', N'y')
                            BEGIN
                                SET @Token2 = @Palabra + N' ' + @Token2;
                                SET @Resto = CASE WHEN @Corte = 0 THEN N'' ELSE LEFT(@Resto, LEN(@Resto) - @Corte) END;
                            END
                            ELSE
                            BEGIN
                                SET @Particula = 0;
                            END
                        END
                    END

                    IF @Resto = N''
                    BEGIN
                        -- Dos partes: nombre y un apellido.
                        UPDATE #Reparto
                        SET FirstName = @Token2,
                            LastNamePaternal = @Token1,
                            LastNameMaternal = NULL
                        WHERE IdEmployee = @IdEmployee;
                    END
                    ELSE
                    BEGIN
                        -- Tres o mas: lo que queda es el nombre, y los dos ultimos los apellidos.
                        UPDATE #Reparto
                        SET FirstName = @Resto,
                            LastNamePaternal = @Token2,
                            LastNameMaternal = @Token1
                        WHERE IdEmployee = @IdEmployee;
                    END
                END

                FETCH NEXT FROM Filas INTO @IdEmployee, @Resto;
            END

            CLOSE Filas;
            DEALLOCATE Filas;

            -- Comprobacion 1: ninguna parte se paso de largo. Recortarla perderia una palabra en
            -- silencio; es mejor detenerse y decidirlo a mano.
            IF EXISTS (
                SELECT 1 FROM #Reparto
                WHERE LEN(FirstName) > 80
                   OR LEN(LastNamePaternal) > 80
                   OR LEN(ISNULL(LastNameMaternal, N'')) > 80)
            BEGIN
                DROP TABLE #Reparto;
                THROW 50006, 'RQ-06: al menos un nombre produjo una parte de mas de 80 caracteres. La migracion se detuvo sin escribir nada.', 1;
            END

            -- Comprobacion 2: el reparto no perdio ni duplico una palabra. Se compara contra el
            -- original NORMALIZADO, no contra el crudo: colapsar espacios es una diferencia
            -- legitima, y compararla contra el crudo daria una alarma que no lo es. Las filas de una
            -- sola palabra quedan fuera porque se les anadio «(sin apellido)» a proposito.
            IF EXISTS (
                SELECT 1 FROM #Reparto
                WHERE LastNamePaternal <> @SinApellido
                  AND Normalizado <> CONCAT(
                        FirstName,
                        N' ',
                        LastNamePaternal,
                        CASE WHEN LastNameMaternal IS NULL THEN N'' ELSE N' ' + LastNameMaternal END))
            BEGIN
                DROP TABLE #Reparto;
                THROW 50007, 'RQ-06: el nombre rearmado no coincide con el original normalizado en al menos una fila. La migracion se detuvo sin escribir nada.', 1;
            END

            -- Comprobacion 3: nadie se queda sin las dos partes obligatorias, que es lo que el paso
            -- siguiente va a exigir con NOT NULL.
            IF EXISTS (
                SELECT 1 FROM #Reparto
                WHERE FirstName IS NULL OR LTRIM(RTRIM(FirstName)) = N''
                   OR LastNamePaternal IS NULL OR LTRIM(RTRIM(LastNamePaternal)) = N'')
            BEGIN
                DROP TABLE #Reparto;
                THROW 50008, 'RQ-06: al menos una fila quedo sin nombre o sin apellido paterno. La migracion se detuvo sin escribir nada.', 1;
            END

            -- Y solo ahora se escribe. FullName se recompone para que quede exactamente lo que el
            -- dominio compondria de las tres partes: a partir de aqui es un derivado.
            UPDATE empleado
            SET FirstName = reparto.FirstName,
                LastNamePaternal = reparto.LastNamePaternal,
                LastNameMaternal = reparto.LastNameMaternal,
                FullName = CONCAT(
                    reparto.FirstName,
                    N' ',
                    reparto.LastNamePaternal,
                    CASE WHEN reparto.LastNameMaternal IS NULL THEN N'' ELSE N' ' + reparto.LastNameMaternal END)
            FROM dbo.Employees AS empleado
            INNER JOIN #Reparto AS reparto ON reparto.IdEmployee = empleado.IdEmployee;

            DROP TABLE #Reparto;
            """;
    }
}
