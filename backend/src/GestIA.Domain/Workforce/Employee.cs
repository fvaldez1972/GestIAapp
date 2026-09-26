using GestIA.Domain.Common;
using GestIA.Domain.Organizations;

namespace GestIA.Domain.Workforce;

public sealed record EmployeeProfile(
    string FirstName,
    string LastNamePaternal,
    string? LastNameMaternal,
    string? JobTitle,
    DateOnly HireDate,
    DateOnly? BirthDate,
    string? BirthPlace,
    string? Sex,
    string? MaritalStatus,
    string? Rfc,
    string? Curp,
    string? SocialSecurityNumber,
    string? VoterIdNumber,
    string? DriverLicenseNumber,
    string? MilitaryServiceCardNumber,
    string? Email,
    string? MobilePhone,
    string? HomePhone,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    string? EmergencyContactRelationship,
    string? Address,
    string? Street,
    string? StreetNumber,
    string? Neighborhood,
    string? Municipality,
    string? State,
    string? PostalCode,
    string? HousingType,
    DateOnly? ResidenceSinceDate,
    string? CountryCode = null,
    Guid? IdJobPositionCatalogItem = null,
    Guid? IdEducationLevelCatalogItem = null);

public sealed class Employee : AuditableEntity, IOrganizationScopedEntity
{
    private readonly List<EmployeeDocument> documents = [];
    private readonly List<EmployeeEvaluation> evaluations = [];

    private Employee()
    {
    }

    private Employee(
        Guid idEmployee,
        Guid idOrganization,
        string codeEmployee,
        string firstName,
        string lastNamePaternal,
        string? lastNameMaternal,
        string? jobTitle,
        DateOnly hireDate,
        Guid actorId,
        string actorName,
        DateTime occurredAt,
        Guid? idJobPositionCatalogItem = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(codeEmployee);
        ArgumentException.ThrowIfNullOrWhiteSpace(firstName);
        ArgumentException.ThrowIfNullOrWhiteSpace(lastNamePaternal);
        IdEmployee = idEmployee;
        IdOrganization = idOrganization;
        CodeEmployee = codeEmployee.Trim();
        Status = EmployeeStatus.Active;
        SetName(firstName, lastNamePaternal, lastNameMaternal);
        JobTitle = string.IsNullOrWhiteSpace(jobTitle) ? null : jobTitle.Trim();
        IdJobPositionCatalogItem = idJobPositionCatalogItem;
        HireDate = hireDate;
        RegisterCreation(actorId, actorName, occurredAt);
    }

    public Guid IdEmployee { get; private set; }
    public Guid IdOrganization { get; private set; }
    public string CodeEmployee { get; private set; } = string.Empty;
    public EmployeeStatus Status { get; private set; }
    public string FirstName { get; private set; } = string.Empty;
    public string LastNamePaternal { get; private set; } = string.Empty;

    /// <summary>Opcional: hay personas con un solo apellido.</summary>
    public string? LastNameMaternal { get; private set; }

    /// <summary>
    /// El nombre completo, <b>derivado</b> de las tres partes.
    ///
    /// <para>No se captura desde RQ-06. Se conserva porque lo leen la búsqueda, el orden
    /// alfabético y ciento y pico de proyecciones; lo que cambió es quién lo llena.</para>
    /// </summary>
    public string FullName { get; private set; } = string.Empty;
    /// <summary>
    /// El puesto de la persona, por identificador contra el catálogo <c>JobPosition</c>.
    ///
    /// <para><b>Es nulable, y eso significa algo distinto de "no cumple".</b> Un valor nulo dice
    /// "no sabemos cuál es su puesto", normalmente porque el texto libre heredado no correspondía
    /// a ninguna entrada del catálogo. La elegibilidad <b>no bloquea</b> por un nulo: no es lo
    /// mismo no cumplir el perfil que no saber cuál es, y tratarlos igual impediría asignar a
    /// gente que sí puede.</para>
    ///
    /// <para>Convive con el texto libre, que se conserva sin tocar hasta que no queden nulos. La
    /// comparación de elegibilidad usa este identificador; el texto ya no decide nada.</para>
    /// </summary>
    public Guid? IdJobPositionCatalogItem { get; private set; }

    /// <summary>
    /// Hasta dónde estudió, contra el catálogo <c>EducationLevel</c>.
    ///
    /// <para><b>El mismo criterio que el puesto, y por la misma razón.</b> Es identificador y no
    /// texto para que se pueda comparar contra lo que pide la posición, que también lo guarda así.
    /// Y un nulo dice «no se sabe», no «no cumple»: de 271 expedientes, ninguno tenía escolaridad
    /// registrada antes del 19 de septiembre de 2026, porque la columna no existía. Bloquear por un
    /// nulo dejaría fuera a toda la plantilla el día del despliegue.</para>
    /// </summary>
    public Guid? IdEducationLevelCatalogItem { get; private set; }

    public string? JobTitle { get; private set; }

    /// <summary>
    /// La fecha de ingreso vigente.
    ///
    /// <para><b>Desde RQ-07 se deriva del periodo laboral más reciente</b> —abierto o cerrado— en vez
    /// de capturarse suelta. Se conserva como columna porque la leen las listas, la búsqueda y los
    /// reportes, y porque la antigüedad sale de restarle hoy; lo que cambia es que ya nadie la escribe
    /// por su cuenta.</para>
    ///
    /// <para><b>La excepción es quien todavía no ha sido contratado.</b> Una persona en candidatura no
    /// tiene periodo —el periodo se abre al contratarla—, así que su fecha de ingreso sigue siendo la
    /// que se capturó en el alta: una fecha prevista, no un hecho. Hacerla nula para ese caso es lo
    /// correcto y es otra tanda: la columna es <c>NOT NULL</c> y la leen quince puntos.</para>
    /// </summary>
    public DateOnly HireDate { get; private set; }
    public DateOnly? BirthDate { get; private set; }
    public string? BirthPlace { get; private set; }
    public string? Sex { get; private set; }
    public string? MaritalStatus { get; private set; }
    public string? Rfc { get; private set; }
    public string? Curp { get; private set; }
    public string? SocialSecurityNumber { get; private set; }
    public string? VoterIdNumber { get; private set; }
    public string? DriverLicenseNumber { get; private set; }
    public string? MilitaryServiceCardNumber { get; private set; }
    public string? Email { get; private set; }
    public string? MobilePhone { get; private set; }
    public string? HomePhone { get; private set; }
    public string? EmergencyContactName { get; private set; }
    public string? EmergencyContactPhone { get; private set; }

    /// <summary>
    /// Qué es de la persona quien figura como contacto de emergencia: madre, cónyuge, hermano.
    ///
    /// <para>Es texto libre y no catálogo. Quien llama en una emergencia necesita saber con quién
    /// habla, y una lista cerrada de parentescos obligaría a elegir mal en los casos que no
    /// contempla.</para>
    /// </summary>
    public string? EmergencyContactRelationship { get; private set; }

    /// <summary>
    /// El domicilio en un solo campo. <b>Rastro heredado desde el 19 de septiembre de 2026.</b>
    ///
    /// <para>La calle y el número viven ahora en <see cref="Street"/> y
    /// <see cref="StreetNumber"/>. Esta columna se conserva llena con lo que hubiera, y su contenido
    /// se copió tal cual a la calle: <b>no se intentó partirlo</b>. Adivinar dónde acaba el nombre
    /// de la vialidad y empieza el número acierta en «Juárez 123» y falla en «Calzada de los 100
    /// Metros 45», y un domicilio partido mal es peor que uno sin partir, porque parece correcto.
    /// Se retira cuando alguien haya repasado los expedientes.</para>
    /// </summary>
    public string? Address { get; private set; }

    /// <summary>El nombre de la vialidad, sin el número.</summary>
    public string? Street { get; private set; }

    /// <summary>
    /// El número, <b>alfanumérico</b>.
    ///
    /// <para>No es un entero, y la diferencia importa: un domicilio real dice «45-A», «S/N» o
    /// «123 int. 4». Guardarlo como número obligaría a tirar el interior, que es justo lo que hace
    /// falta para encontrar a alguien.</para>
    /// </summary>
    public string? StreetNumber { get; private set; }

    /// <summary>La colonia del domicilio. Texto libre por la decisión D-05.</summary>
    public string? Neighborhood { get; private set; }
    public string? Municipality { get; private set; }
    public string? State { get; private set; }
    public string? CountryCode { get; private set; }
    public string? PostalCode { get; private set; }
    public string? HousingType { get; private set; }
    public DateOnly? ResidenceSinceDate { get; private set; }
    public Organization Organization { get; private set; } = null!;
    public IReadOnlyCollection<EmployeeDocument> Documents => documents;
    public IReadOnlyCollection<EmployeeEvaluation> Evaluations => evaluations;

    /// <summary>
    /// Alta breve.
    ///
    /// <para><c>idJobPositionCatalogItem</c> es opcional pero <b>existe a propósito</b>: sin él esta
    /// sobrecarga no podía expresar un empleado con el puesto ligado al catálogo, y quien la usaba
    /// creaba gente con el puesto sólo como texto. La elegibilidad se compara por identificador, así
    /// que ese expediente queda sin poder comprobarse.</para>
    /// </summary>
    public static Employee Create(
        Guid idOrganization,
        string codeEmployee,
        string firstName,
        string lastNamePaternal,
        string? lastNameMaternal,
        string? jobTitle,
        DateOnly hireDate,
        Guid actorId,
        string actorName,
        DateTime occurredAt,
        Guid? idJobPositionCatalogItem = null) =>
        new(
            Guid.NewGuid(),
            idOrganization,
            codeEmployee,
            firstName,
            lastNamePaternal,
            lastNameMaternal,
            jobTitle,
            hireDate,
            actorId,
            actorName,
            occurredAt,
            idJobPositionCatalogItem);

    public static Employee Create(
        Guid idOrganization,
        string codeEmployee,
        EmployeeProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        var employee = Create(
            idOrganization,
            codeEmployee,
            profile.FirstName,
            profile.LastNamePaternal,
            profile.LastNameMaternal,
            profile.JobTitle,
            profile.HireDate,
            actorId,
            actorName,
            occurredAt);
        employee.ApplyProfile(profile);
        return employee;
    }

    public void UpdateProfile(
        EmployeeProfile profile,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        ApplyProfile(profile);
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    /// <summary>
    /// Los periodos laborales de esta persona.
    ///
    /// <para>Están en el agregado y no sueltos porque las reglas que los gobiernan —como máximo un
    /// periodo abierto, la antigüedad desde el último ingreso— son reglas <i>sobre el conjunto</i>, y
    /// desde fuera nadie puede garantizarlas.</para>
    /// </summary>
    public IReadOnlyCollection<EmploymentPeriod> EmploymentPeriods => employmentPeriods;

    private readonly List<EmploymentPeriod> employmentPeriods = [];

    /// <summary>El periodo abierto, si la persona está contratada ahora mismo.</summary>
    public EmploymentPeriod? OpenEmploymentPeriod =>
        employmentPeriods.SingleOrDefault(periodo => periodo.IsOpen);

    /// <summary>
    /// Desde cuándo cuenta la antigüedad: el ingreso del periodo más reciente.
    ///
    /// <para>Los periodos anteriores <b>no suman</b>. Es la regla que el documento de la reunión marcó
    /// como la buena, y la razón por la que existe esta tabla.</para>
    /// </summary>
    public DateOnly? SeniorityStartDate =>
        employmentPeriods.Count == 0
            ? null
            : employmentPeriods.Max(periodo => periodo.StartDate);

    /// <summary>
    /// Abre el primer periodo de quien estaba en candidatura.
    ///
    /// <para>Es el acto que convierte una candidatura en una contratación, y hasta RQ-07 no existía:
    /// la pantalla no tenía ninguna acción que llevara a alguien de candidata a activa.</para>
    /// </summary>
    public EmploymentPeriod Hire(DateOnly startDate, Guid actorId, string actorName, DateTime occurredAt)
    {
        if (employmentPeriods.Count > 0)
        {
            throw new DomainRuleException(
                "Esta persona ya tiene historial laboral. Para volver a contratarla se registra un " +
                "reingreso, no una contratación nueva.");
        }

        return OpenPeriod(startDate, actorId, actorName, occurredAt);
    }

    /// <summary>
    /// Cierra el periodo abierto con su fecha de baja y su motivo, y deja a la persona dada de baja.
    ///
    /// <para>Un permiso <b>no</b> pasa por aquí: quien está en permiso sigue contratada y su antigüedad
    /// no se interrumpe.</para>
    /// </summary>
    public EmploymentPeriod Terminate(
        DateOnly endDate,
        string terminationReason,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        var abierto = OpenEmploymentPeriod
            ?? throw new DomainRuleException(
                "Esta persona no tiene un periodo laboral abierto, así que no hay nada que dar de baja.");

        abierto.Close(endDate, terminationReason, actorId, actorName, occurredAt);
        Status = EmployeeStatus.Terminated;
        RegisterUpdate(actorId, actorName, occurredAt);
        return abierto;
    }

    /// <summary>
    /// Abre un periodo nuevo para quien estaba dada de baja. Puede repetirse sin límite.
    ///
    /// <para>No se recaptura nada del expediente: la persona ya está aquí, con sus documentos, su
    /// domicilio y su historial. Lo único nuevo es la fecha de ingreso de este periodo.</para>
    /// </summary>
    public EmploymentPeriod Rehire(DateOnly startDate, Guid actorId, string actorName, DateTime occurredAt)
    {
        if (Status != EmployeeStatus.Terminated)
        {
            throw new DomainRuleException("El reingreso sólo se registra sobre alguien dado de baja.");
        }

        if (OpenEmploymentPeriod is not null)
        {
            throw new DomainRuleException("Esta persona ya tiene un periodo laboral abierto.");
        }

        var ultimaBaja = employmentPeriods.Count == 0
            ? null
            : employmentPeriods.Max(periodo => periodo.EndDate);

        if (ultimaBaja is not null && startDate < ultimaBaja)
        {
            throw new DomainRuleException(
                "La fecha de reingreso no puede ser anterior a la baja que la precede.");
        }

        return OpenPeriod(startDate, actorId, actorName, occurredAt);
    }

    /// <summary>
    /// Registra un periodo que la persona ya tenía cuando la tabla no existía.
    ///
    /// <para>Sólo lo usan la migración y el sembrador de datos demo: es la puerta para sembrar
    /// historial sin pasar por las reglas de movimiento, que exigen un estado de partida que estos
    /// expedientes ya traen puesto.</para>
    /// </summary>
    public EmploymentPeriod RegisterExistingPeriod(
        DateOnly startDate,
        DateOnly? endDate,
        string? terminationReason,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        var periodo = EmploymentPeriod.Open(
            IdOrganization, IdEmployee, startDate, actorId, actorName, occurredAt);

        if (endDate is not null)
        {
            periodo.Close(endDate.Value, terminationReason ?? string.Empty, actorId, actorName, occurredAt);
        }

        employmentPeriods.Add(periodo);
        HireDate = SeniorityStartDate ?? HireDate;
        return periodo;
    }

    private EmploymentPeriod OpenPeriod(
        DateOnly startDate,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        var periodo = EmploymentPeriod.Open(
            IdOrganization, IdEmployee, startDate, actorId, actorName, occurredAt);

        employmentPeriods.Add(periodo);

        // La fecha de ingreso es un derivado del periodo mas reciente, igual que el nombre completo es
        // un derivado de sus tres partes: un unico punto de escritura.
        HireDate = SeniorityStartDate ?? startDate;
        Status = EmployeeStatus.Active;
        RegisterUpdate(actorId, actorName, occurredAt);
        return periodo;
    }

    public void ChangeStatus(
        EmployeeStatus status,
        Guid actorId,
        string actorName,
        DateTime occurredAt)
    {
        Status = status;
        RegisterUpdate(actorId, actorName, occurredAt);
    }

    /// <summary>
    /// El único sitio donde se escribe el nombre.
    ///
    /// <para>Las tres partes se recortan y el completo se compone de ellas. Que sea un solo sitio
    /// es lo que impide que existan un <c>FullName</c> y unas partes diciendo cosas distintas de
    /// la misma persona: nadie puede escribir el completo por su cuenta.</para>
    /// </summary>
    private void SetName(string firstName, string lastNamePaternal, string? lastNameMaternal)
    {
        FirstName = firstName.Trim();
        LastNamePaternal = lastNamePaternal.Trim();
        LastNameMaternal = string.IsNullOrWhiteSpace(lastNameMaternal) ? null : lastNameMaternal.Trim();
        FullName = EmployeeName.Compose(FirstName, LastNamePaternal, LastNameMaternal);
    }

    private void ApplyProfile(EmployeeProfile profile)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(profile.FirstName);
        ArgumentException.ThrowIfNullOrWhiteSpace(profile.LastNamePaternal);

        SetName(profile.FirstName, profile.LastNamePaternal, profile.LastNameMaternal);
        IdJobPositionCatalogItem = profile.IdJobPositionCatalogItem;
        IdEducationLevelCatalogItem = profile.IdEducationLevelCatalogItem;
        JobTitle = Normalize(profile.JobTitle);

        // Mientras la persona no tenga periodo --esto es, mientras siga en candidatura-- la fecha de
        // ingreso es la que se capturo. En cuanto hay periodo, manda el periodo: editar el expediente
        // no puede mover una fecha que ya es un hecho registrado.
        HireDate = SeniorityStartDate ?? profile.HireDate;
        BirthDate = profile.BirthDate;
        BirthPlace = Normalize(profile.BirthPlace);
        Sex = Normalize(profile.Sex);
        MaritalStatus = Normalize(profile.MaritalStatus);
        Rfc = NormalizeUpper(profile.Rfc);
        Curp = NormalizeUpper(profile.Curp);
        SocialSecurityNumber = Normalize(profile.SocialSecurityNumber);
        VoterIdNumber = NormalizeUpper(profile.VoterIdNumber);
        DriverLicenseNumber = NormalizeUpper(profile.DriverLicenseNumber);
        MilitaryServiceCardNumber = NormalizeUpper(profile.MilitaryServiceCardNumber);
        Email = NormalizeLower(profile.Email);
        MobilePhone = Normalize(profile.MobilePhone);
        HomePhone = Normalize(profile.HomePhone);
        EmergencyContactName = Normalize(profile.EmergencyContactName);
        EmergencyContactPhone = Normalize(profile.EmergencyContactPhone);
        EmergencyContactRelationship = Normalize(profile.EmergencyContactRelationship);
        Address = Normalize(profile.Address);
        Street = Normalize(profile.Street);
        StreetNumber = Normalize(profile.StreetNumber);
        Neighborhood = Normalize(profile.Neighborhood);
        Municipality = Normalize(profile.Municipality);
        State = Normalize(profile.State);
        CountryCode = Normalize(profile.CountryCode)?.ToUpperInvariant();
        PostalCode = Normalize(profile.PostalCode);
        HousingType = Normalize(profile.HousingType);
        ResidenceSinceDate = profile.ResidenceSinceDate;
    }

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? NormalizeUpper(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToUpperInvariant();

    private static string? NormalizeLower(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToLowerInvariant();
}
