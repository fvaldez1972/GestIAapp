using GestIA.Application.Common;
using GestIA.Domain.Workforce;

namespace GestIA.Application.Workforce;

public sealed class WorkforceService(
    IWorkforceRepository repository,
    IUnitOfWork unitOfWork,
    IActorContext actorContext,
    IClock clock) : IWorkforceService
{
    public async Task<PagedResult<EmployeeResponse>> ListEmployeesAsync(
        EmployeeQuery query,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        if (query.IdOrganization == Guid.Empty)
        {
            errors[nameof(query.IdOrganization)] = ["La organización es obligatoria."];
        }

        InputValidation.Page(query.Page, query.PageSize, errors);
        ThrowIfInvalid(errors);

        if (!await repository.OrganizationExistsAsync(query.IdOrganization, cancellationToken))
        {
            throw new ResourceNotFoundException("No se encontró la organización solicitada.");
        }

        return (await repository.ListEmployeesAsync(query, cancellationToken)).ToPagedResult();
    }

    public async Task<EmployeeDetailResponse> GetEmployeeAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken)
    {
        var employee = await EnsureEmployeeAsync(idOrganization, idEmployee, cancellationToken);
        var documents = await repository.ListDocumentsAsync(idEmployee, cancellationToken);
        var evaluations = await repository.ListEvaluationsAsync(idEmployee, cancellationToken);
        return new EmployeeDetailResponse(
            Map(employee),
            documents.Select(Map).ToArray(),
            evaluations.Select(Map).ToArray());
    }

    public async Task<EmployeeResponse> CreateEmployeeAsync(
        CreateEmployeeRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureOrganizationAsync(request.IdOrganization, cancellationToken);
        var code = NormalizeCode(request.CodeEmployee, nameof(request.CodeEmployee));
        var profile = Validate(request);
        await EnsureUniqueIdentifiersAsync(
            request.IdOrganization,
            code,
            profile.Rfc,
            profile.Curp,
            profile.SocialSecurityNumber,
            null,
            cancellationToken);

        var employee = Employee.Create(
            request.IdOrganization,
            code,
            profile,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await repository.AddEmployeeAsync(employee, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(employee);
    }

    public async Task<EmployeeResponse> UpdateEmployeeAsync(
        Guid idEmployee,
        UpdateEmployeeRequest request,
        CancellationToken cancellationToken)
    {
        var employee = await EnsureEmployeeAsync(request.IdOrganization, idEmployee, cancellationToken);
        var profile = Validate(request);
        await EnsureUniqueIdentifiersAsync(
            request.IdOrganization,
            employee.CodeEmployee,
            profile.Rfc,
            profile.Curp,
            profile.SocialSecurityNumber,
            idEmployee,
            cancellationToken);

        employee.UpdateProfile(profile, actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(employee);
    }

    public async Task<EmployeeResponse> ChangeStatusAsync(
        Guid idEmployee,
        ChangeEmployeeStatusRequest request,
        CancellationToken cancellationToken)
    {
        var employee = await EnsureEmployeeAsync(request.IdOrganization, idEmployee, cancellationToken);
        employee.ChangeStatus(request.Status, actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(employee);
    }

    public async Task DeactivateEmployeeAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken)
    {
        var employee = await EnsureEmployeeAsync(idOrganization, idEmployee, cancellationToken);
        employee.ChangeStatus(EmployeeStatus.Inactive, actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        employee.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<EmployeeDocumentResponse>> ListDocumentsAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken)
    {
        await EnsureEmployeeAsync(idOrganization, idEmployee, cancellationToken);
        var documents = await repository.ListDocumentsAsync(idEmployee, cancellationToken);
        return documents.Select(Map).ToArray();
    }

    public async Task<EmployeeDocumentResponse> CreateDocumentAsync(
        CreateEmployeeDocumentRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureEmployeeAsync(request.IdOrganization, request.IdEmployee, cancellationToken);
        var profile = Validate(request);
        var document = EmployeeDocument.Create(
            request.IdEmployee,
            profile,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await repository.AddDocumentAsync(document, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(document);
    }

    public async Task<EmployeeDocumentResponse> UpdateDocumentAsync(
        Guid idEmployeeDocument,
        UpdateEmployeeDocumentRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureEmployeeAsync(request.IdOrganization, request.IdEmployee, cancellationToken);
        var profile = Validate(request);
        var document = await repository.GetDocumentAsync(request.IdEmployee, idEmployeeDocument, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el documento solicitado.");

        document.UpdateProfile(profile, actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(document);
    }

    public async Task DeactivateDocumentAsync(
        Guid idOrganization,
        Guid idEmployee,
        Guid idEmployeeDocument,
        CancellationToken cancellationToken)
    {
        await EnsureEmployeeAsync(idOrganization, idEmployee, cancellationToken);
        var document = await repository.GetDocumentAsync(idEmployee, idEmployeeDocument, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el documento solicitado.");

        document.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<EmployeeEvaluationResponse>> ListEvaluationsAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken)
    {
        await EnsureEmployeeAsync(idOrganization, idEmployee, cancellationToken);
        var evaluations = await repository.ListEvaluationsAsync(idEmployee, cancellationToken);
        return evaluations.Select(Map).ToArray();
    }

    public async Task<EmployeeEvaluationResponse> CreateEvaluationAsync(
        CreateEmployeeEvaluationRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureEmployeeAsync(request.IdOrganization, request.IdEmployee, cancellationToken);
        var profile = Validate(request);

        if (await repository.IsEvaluationInUseAsync(
                request.IdEmployee,
                profile.EvaluationType,
                profile.EvaluatedDate,
                null,
                cancellationToken))
        {
            throw new ResourceConflictException("Ya existe una evaluación del mismo tipo en la misma fecha.");
        }

        var evaluation = EmployeeEvaluation.Create(
            request.IdEmployee,
            profile,
            actorContext.ActorId,
            actorContext.ActorName,
            clock.UtcNow);

        await repository.AddEvaluationAsync(evaluation, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(evaluation);
    }

    public async Task<EmployeeEvaluationResponse> UpdateEvaluationAsync(
        Guid idEmployeeEvaluation,
        UpdateEmployeeEvaluationRequest request,
        CancellationToken cancellationToken)
    {
        await EnsureEmployeeAsync(request.IdOrganization, request.IdEmployee, cancellationToken);
        var profile = Validate(request);
        var evaluation = await repository.GetEvaluationAsync(
                request.IdEmployee,
                idEmployeeEvaluation,
                cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la evaluación solicitada.");

        if (await repository.IsEvaluationInUseAsync(
                request.IdEmployee,
                profile.EvaluationType,
                profile.EvaluatedDate,
                idEmployeeEvaluation,
                cancellationToken))
        {
            throw new ResourceConflictException("Ya existe una evaluación del mismo tipo en la misma fecha.");
        }

        evaluation.UpdateProfile(profile, actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return Map(evaluation);
    }

    public async Task DeactivateEvaluationAsync(
        Guid idOrganization,
        Guid idEmployee,
        Guid idEmployeeEvaluation,
        CancellationToken cancellationToken)
    {
        await EnsureEmployeeAsync(idOrganization, idEmployee, cancellationToken);
        var evaluation = await repository.GetEvaluationAsync(idEmployee, idEmployeeEvaluation, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró la evaluación solicitada.");

        evaluation.Deactivate(actorContext.ActorId, actorContext.ActorName, clock.UtcNow);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsureOrganizationAsync(Guid idOrganization, CancellationToken cancellationToken)
    {
        if (idOrganization == Guid.Empty)
        {
            throw new RequestValidationException(new Dictionary<string, string[]>
            {
                [nameof(idOrganization)] = ["La organización es obligatoria."]
            });
        }

        if (!await repository.OrganizationExistsAsync(idOrganization, cancellationToken))
        {
            throw new ResourceNotFoundException("No se encontró la organización solicitada.");
        }
    }

    private async Task<Employee> EnsureEmployeeAsync(
        Guid idOrganization,
        Guid idEmployee,
        CancellationToken cancellationToken)
    {
        if (idOrganization == Guid.Empty || idEmployee == Guid.Empty)
        {
            throw new RequestValidationException(new Dictionary<string, string[]>
            {
                [nameof(idOrganization)] = ["La organización es obligatoria."],
                [nameof(idEmployee)] = ["El empleado es obligatorio."]
            });
        }

        return await repository.GetEmployeeAsync(idOrganization, idEmployee, cancellationToken)
            ?? throw new ResourceNotFoundException("No se encontró el empleado solicitado.");
    }

    private async Task EnsureUniqueIdentifiersAsync(
        Guid idOrganization,
        string codeEmployee,
        string? rfc,
        string? curp,
        string? socialSecurityNumber,
        Guid? excludedEmployeeId,
        CancellationToken cancellationToken)
    {
        if (await repository.IsEmployeeCodeInUseAsync(idOrganization, codeEmployee, excludedEmployeeId, cancellationToken))
        {
            throw new ResourceConflictException($"Ya existe un empleado con el código '{codeEmployee}'.");
        }

        if (!string.IsNullOrWhiteSpace(rfc) &&
            await repository.IsRfcInUseAsync(idOrganization, rfc, excludedEmployeeId, cancellationToken))
        {
            throw new ResourceConflictException($"Ya existe un empleado con el RFC '{rfc}'.");
        }

        if (!string.IsNullOrWhiteSpace(curp) &&
            await repository.IsCurpInUseAsync(idOrganization, curp, excludedEmployeeId, cancellationToken))
        {
            throw new ResourceConflictException($"Ya existe un empleado con el CURP '{curp}'.");
        }

        if (!string.IsNullOrWhiteSpace(socialSecurityNumber) &&
            await repository.IsSocialSecurityNumberInUseAsync(
                idOrganization,
                socialSecurityNumber,
                excludedEmployeeId,
                cancellationToken))
        {
            throw new ResourceConflictException("Ya existe un empleado con el número de seguridad social capturado.");
        }
    }

    private static EmployeeProfile Validate(CreateEmployeeRequest request) =>
        ValidateProfile(
            request.FullName,
            request.JobTitle,
            request.HireDate,
            request.BirthDate,
            request.BirthPlace,
            request.Sex,
            request.MaritalStatus,
            request.Rfc,
            request.Curp,
            request.SocialSecurityNumber,
            request.VoterIdNumber,
            request.DriverLicenseNumber,
            request.MilitaryServiceCardNumber,
            request.Email,
            request.MobilePhone,
            request.HomePhone,
            request.EmergencyContactName,
            request.EmergencyContactPhone,
            request.Address,
            request.Municipality,
            request.State,
            request.PostalCode,
            request.HousingType,
            request.ResidenceSinceDate);

    private static EmployeeProfile Validate(UpdateEmployeeRequest request) =>
        ValidateProfile(
            request.FullName,
            request.JobTitle,
            request.HireDate,
            request.BirthDate,
            request.BirthPlace,
            request.Sex,
            request.MaritalStatus,
            request.Rfc,
            request.Curp,
            request.SocialSecurityNumber,
            request.VoterIdNumber,
            request.DriverLicenseNumber,
            request.MilitaryServiceCardNumber,
            request.Email,
            request.MobilePhone,
            request.HomePhone,
            request.EmergencyContactName,
            request.EmergencyContactPhone,
            request.Address,
            request.Municipality,
            request.State,
            request.PostalCode,
            request.HousingType,
            request.ResidenceSinceDate);

    private static EmployeeProfile ValidateProfile(
        string fullName,
        string? jobTitle,
        DateOnly hireDate,
        DateOnly? birthDate,
        string? birthPlace,
        string? sex,
        string? maritalStatus,
        string? rfc,
        string? curp,
        string? socialSecurityNumber,
        string? voterIdNumber,
        string? driverLicenseNumber,
        string? militaryServiceCardNumber,
        string? email,
        string? mobilePhone,
        string? homePhone,
        string? emergencyContactName,
        string? emergencyContactPhone,
        string? address,
        string? municipality,
        string? state,
        string? postalCode,
        string? housingType,
        DateOnly? residenceSinceDate)
    {
        var errors = new Dictionary<string, string[]>();
        Required(fullName, nameof(fullName), 200, errors);
        MaxLength(jobTitle, nameof(jobTitle), 120, errors);
        MaxLength(birthPlace, nameof(birthPlace), 150, errors);
        MaxLength(sex, nameof(sex), 30, errors);
        MaxLength(maritalStatus, nameof(maritalStatus), 40, errors);
        MaxLength(rfc, nameof(rfc), 13, errors);
        MaxLength(curp, nameof(curp), 18, errors);
        MaxLength(socialSecurityNumber, nameof(socialSecurityNumber), 20, errors);
        MaxLength(voterIdNumber, nameof(voterIdNumber), 30, errors);
        MaxLength(driverLicenseNumber, nameof(driverLicenseNumber), 40, errors);
        MaxLength(militaryServiceCardNumber, nameof(militaryServiceCardNumber), 40, errors);
        MaxLength(email, nameof(email), 254, errors);
        MaxLength(mobilePhone, nameof(mobilePhone), 30, errors);
        MaxLength(homePhone, nameof(homePhone), 30, errors);
        MaxLength(emergencyContactName, nameof(emergencyContactName), 200, errors);
        MaxLength(emergencyContactPhone, nameof(emergencyContactPhone), 30, errors);
        MaxLength(address, nameof(address), 500, errors);
        MaxLength(municipality, nameof(municipality), 120, errors);
        MaxLength(state, nameof(state), 120, errors);
        MaxLength(postalCode, nameof(postalCode), 10, errors);
        MaxLength(housingType, nameof(housingType), 30, errors);
        ThrowIfInvalid(errors);

        return new EmployeeProfile(
            fullName,
            jobTitle,
            hireDate,
            birthDate,
            birthPlace,
            sex,
            maritalStatus,
            NormalizeUpper(rfc),
            NormalizeUpper(curp),
            Normalize(socialSecurityNumber),
            voterIdNumber,
            driverLicenseNumber,
            militaryServiceCardNumber,
            NormalizeLower(email),
            mobilePhone,
            homePhone,
            emergencyContactName,
            emergencyContactPhone,
            address,
            municipality,
            state,
            postalCode,
            housingType,
            residenceSinceDate);
    }

    private static EmployeeDocumentProfile Validate(CreateEmployeeDocumentRequest request) =>
        ValidateDocumentProfile(
            request.DocumentType,
            request.Status,
            request.DocumentNumber,
            request.ReceivedDate,
            request.IssuedDate,
            request.ExpiresDate,
            request.StorageReference,
            request.Notes);

    private static EmployeeDocumentProfile Validate(UpdateEmployeeDocumentRequest request) =>
        ValidateDocumentProfile(
            request.DocumentType,
            request.Status,
            request.DocumentNumber,
            request.ReceivedDate,
            request.IssuedDate,
            request.ExpiresDate,
            request.StorageReference,
            request.Notes);

    private static EmployeeDocumentProfile ValidateDocumentProfile(
        EmployeeDocumentType documentType,
        EmployeeDocumentStatus status,
        string? documentNumber,
        DateOnly? receivedDate,
        DateOnly? issuedDate,
        DateOnly? expiresDate,
        string? storageReference,
        string? notes)
    {
        var errors = new Dictionary<string, string[]>();
        MaxLength(documentNumber, nameof(documentNumber), 80, errors);
        MaxLength(storageReference, nameof(storageReference), 500, errors);
        MaxLength(notes, nameof(notes), 1000, errors);
        if (expiresDate < issuedDate)
        {
            errors[nameof(expiresDate)] = ["La fecha de vencimiento no puede ser menor a la fecha de emisión."];
        }

        ThrowIfInvalid(errors);
        return new EmployeeDocumentProfile(
            documentType,
            status,
            documentNumber,
            receivedDate,
            issuedDate,
            expiresDate,
            storageReference,
            notes);
    }

    private static EmployeeEvaluationProfile Validate(CreateEmployeeEvaluationRequest request) =>
        ValidateEvaluationProfile(
            request.EvaluationType,
            request.Result,
            request.EvaluatedDate,
            request.ExpiresDate,
            request.CertificateNumber,
            request.StorageReference,
            request.Notes);

    private static EmployeeEvaluationProfile Validate(UpdateEmployeeEvaluationRequest request) =>
        ValidateEvaluationProfile(
            request.EvaluationType,
            request.Result,
            request.EvaluatedDate,
            request.ExpiresDate,
            request.CertificateNumber,
            request.StorageReference,
            request.Notes);

    private static EmployeeEvaluationProfile ValidateEvaluationProfile(
        EmployeeEvaluationType evaluationType,
        EmployeeEvaluationResult result,
        DateOnly evaluatedDate,
        DateOnly? expiresDate,
        string? certificateNumber,
        string? storageReference,
        string? notes)
    {
        var errors = new Dictionary<string, string[]>();
        MaxLength(certificateNumber, nameof(certificateNumber), 80, errors);
        MaxLength(storageReference, nameof(storageReference), 500, errors);
        MaxLength(notes, nameof(notes), 1000, errors);
        if (expiresDate < evaluatedDate)
        {
            errors[nameof(expiresDate)] = ["La fecha de vencimiento no puede ser menor a la fecha evaluada."];
        }

        ThrowIfInvalid(errors);
        return new EmployeeEvaluationProfile(
            evaluationType,
            result,
            evaluatedDate,
            expiresDate,
            certificateNumber,
            storageReference,
            notes);
    }

    private static string NormalizeCode(string value, string fieldName)
    {
        var errors = new Dictionary<string, string[]>();
        Required(value, fieldName, 30, errors);
        ThrowIfInvalid(errors);
        return value.Trim().ToUpperInvariant();
    }

    private static void Required(
        string? value,
        string fieldName,
        int maximumLength,
        Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            errors[fieldName] = ["El campo es obligatorio."];
            return;
        }

        MaxLength(value, fieldName, maximumLength, errors);
    }

    private static void MaxLength(
        string? value,
        string fieldName,
        int maximumLength,
        Dictionary<string, string[]> errors)
    {
        if (!string.IsNullOrWhiteSpace(value) && value.Trim().Length > maximumLength)
        {
            errors[fieldName] = [$"No puede exceder {maximumLength} caracteres."];
        }
    }

    private static void ThrowIfInvalid(Dictionary<string, string[]> errors)
    {
        if (errors.Count > 0)
        {
            throw new RequestValidationException(errors);
        }
    }

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? NormalizeUpper(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToUpperInvariant();

    private static string? NormalizeLower(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToLowerInvariant();

    private static EmployeeResponse Map(Employee employee) =>
        new(
            employee.IdEmployee,
            employee.IdOrganization,
            employee.CodeEmployee,
            employee.Status,
            employee.FullName,
            employee.JobTitle,
            employee.HireDate,
            employee.BirthDate,
            employee.BirthPlace,
            employee.Sex,
            employee.MaritalStatus,
            employee.Rfc,
            employee.Curp,
            employee.SocialSecurityNumber,
            employee.VoterIdNumber,
            employee.DriverLicenseNumber,
            employee.MilitaryServiceCardNumber,
            employee.Email,
            employee.MobilePhone,
            employee.HomePhone,
            employee.EmergencyContactName,
            employee.EmergencyContactPhone,
            employee.Address,
            employee.Municipality,
            employee.State,
            employee.PostalCode,
            employee.HousingType,
            employee.ResidenceSinceDate,
            employee.Active,
            employee.CreatedAt,
            employee.UpdatedAt);

    private static EmployeeDocumentResponse Map(EmployeeDocument document) =>
        new(
            document.IdEmployeeDocument,
            document.IdEmployee,
            document.DocumentType,
            document.Status,
            document.DocumentNumber,
            document.ReceivedDate,
            document.IssuedDate,
            document.ExpiresDate,
            document.StorageReference,
            document.Notes,
            document.Active);

    private static EmployeeEvaluationResponse Map(EmployeeEvaluation evaluation) =>
        new(
            evaluation.IdEmployeeEvaluation,
            evaluation.IdEmployee,
            evaluation.EvaluationType,
            evaluation.Result,
            evaluation.EvaluatedDate,
            evaluation.ExpiresDate,
            evaluation.CertificateNumber,
            evaluation.StorageReference,
            evaluation.Notes,
            evaluation.Active);
}
