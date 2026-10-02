using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable
#pragma warning disable CA1861 // EF Core generates local arrays for composite indexes.

namespace GestIA.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialBusinessModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "dbo");

            migrationBuilder.CreateTable(
                name: "Organizations",
                schema: "dbo",
                columns: table => new
                {
                    IdOrganization = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CodeOrganization = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: false),
                    LegalName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Rfc = table.Column<string>(type: "varchar(13)", unicode: false, maxLength: 13, nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_Organizations_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_Organizations_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Organizations", x => x.IdOrganization);
                });

            migrationBuilder.CreateTable(
                name: "Clients",
                schema: "dbo",
                columns: table => new
                {
                    IdClient = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdOrganization = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CodeClient = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: false),
                    LegalName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    TradeName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Rfc = table.Column<string>(type: "varchar(13)", unicode: false, maxLength: 13, nullable: false),
                    Nationality = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    TaxActivity = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    TaxAddress = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    PublicRegistryDate = table.Column<DateOnly>(type: "date", nullable: true),
                    CommercialRegistryFolio = table.Column<string>(type: "varchar(80)", unicode: false, maxLength: 80, nullable: true),
                    EmployerRegistrationNumber = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: true),
                    IncorporationDate = table.Column<DateOnly>(type: "date", nullable: true),
                    IncorporationDeedNumber = table.Column<string>(type: "varchar(50)", unicode: false, maxLength: 50, nullable: true),
                    LegalRepresentativeInstrumentNumber = table.Column<string>(type: "varchar(80)", unicode: false, maxLength: 80, nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_Clients_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_Clients_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Clients", x => x.IdClient);
                    table.ForeignKey(
                        name: "FK_Clients_Organizations_IdOrganization",
                        column: x => x.IdOrganization,
                        principalSchema: "dbo",
                        principalTable: "Organizations",
                        principalColumn: "IdOrganization",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Employees",
                schema: "dbo",
                columns: table => new
                {
                    IdEmployee = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdOrganization = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CodeEmployee = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: false),
                    Status = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    JobTitle = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    HireDate = table.Column<DateOnly>(type: "date", nullable: false),
                    BirthDate = table.Column<DateOnly>(type: "date", nullable: true),
                    BirthPlace = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Sex = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    MaritalStatus = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    Rfc = table.Column<string>(type: "varchar(13)", unicode: false, maxLength: 13, nullable: true),
                    Curp = table.Column<string>(type: "varchar(18)", unicode: false, maxLength: 18, nullable: true),
                    SocialSecurityNumber = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: true),
                    VoterIdNumber = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: true),
                    DriverLicenseNumber = table.Column<string>(type: "varchar(40)", unicode: false, maxLength: 40, nullable: true),
                    MilitaryServiceCardNumber = table.Column<string>(type: "varchar(40)", unicode: false, maxLength: 40, nullable: true),
                    Email = table.Column<string>(type: "varchar(254)", unicode: false, maxLength: 254, nullable: true),
                    MobilePhone = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: true),
                    HomePhone = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: true),
                    EmergencyContactName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    EmergencyContactPhone = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: true),
                    Address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Municipality = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    State = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    PostalCode = table.Column<string>(type: "varchar(10)", unicode: false, maxLength: 10, nullable: true),
                    HousingType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    ResidenceSinceDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_Employees_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_Employees_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Employees", x => x.IdEmployee);
                    table.ForeignKey(
                        name: "FK_Employees_Organizations_IdOrganization",
                        column: x => x.IdOrganization,
                        principalSchema: "dbo",
                        principalTable: "Organizations",
                        principalColumn: "IdOrganization",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ClientSites",
                schema: "dbo",
                columns: table => new
                {
                    IdClientSite = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdClient = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CodeClientSite = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Street = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ExteriorNumber = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    InteriorNumber = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    Neighborhood = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    Municipality = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    State = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    PostalCode = table.Column<string>(type: "varchar(10)", unicode: false, maxLength: 10, nullable: false),
                    CountryCode = table.Column<string>(type: "varchar(2)", unicode: false, maxLength: 2, nullable: false, defaultValue: "MX")
                        .Annotation("Relational:DefaultConstraintName", "DF_ClientSites_CountryCode"),
                    AccessInstructions = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    TimeZoneId = table.Column<string>(type: "varchar(100)", unicode: false, maxLength: 100, nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_ClientSites_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_ClientSites_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientSites", x => x.IdClientSite);
                    table.ForeignKey(
                        name: "FK_ClientSites_Clients_IdClient",
                        column: x => x.IdClient,
                        principalSchema: "dbo",
                        principalTable: "Clients",
                        principalColumn: "IdClient",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ServiceContracts",
                schema: "dbo",
                columns: table => new
                {
                    IdServiceContract = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdClient = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CodeServiceContract = table.Column<string>(type: "varchar(50)", unicode: false, maxLength: 50, nullable: false),
                    Status = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: false),
                    SignedDate = table.Column<DateOnly>(type: "date", nullable: true),
                    EffectiveFromDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EffectiveToDate = table.Column<DateOnly>(type: "date", nullable: true),
                    PaymentTermDays = table.Column<short>(type: "smallint", nullable: false),
                    TerminationNoticeDays = table.Column<short>(type: "smallint", nullable: false),
                    CurrencyCode = table.Column<string>(type: "varchar(3)", unicode: false, maxLength: 3, nullable: false, defaultValue: "MXN")
                        .Annotation("Relational:DefaultConstraintName", "DF_ServiceContracts_CurrencyCode"),
                    DocumentReference = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_ServiceContracts_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_ServiceContracts_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceContracts", x => x.IdServiceContract);
                    table.CheckConstraint("CK_ServiceContracts_EffectiveDateRange", "[EffectiveToDate] IS NULL OR [EffectiveToDate] >= [EffectiveFromDate]");
                    table.CheckConstraint("CK_ServiceContracts_PaymentTermDays", "[PaymentTermDays] >= 0");
                    table.CheckConstraint("CK_ServiceContracts_TerminationNoticeDays", "[TerminationNoticeDays] >= 0");
                    table.ForeignKey(
                        name: "FK_ServiceContracts_Clients_IdClient",
                        column: x => x.IdClient,
                        principalSchema: "dbo",
                        principalTable: "Clients",
                        principalColumn: "IdClient",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "EmployeeDocuments",
                schema: "dbo",
                columns: table => new
                {
                    IdEmployeeDocument = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdEmployee = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DocumentType = table.Column<string>(type: "varchar(50)", unicode: false, maxLength: 50, nullable: false),
                    Status = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: false),
                    DocumentNumber = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    ReceivedDate = table.Column<DateOnly>(type: "date", nullable: true),
                    IssuedDate = table.Column<DateOnly>(type: "date", nullable: true),
                    ExpiresDate = table.Column<DateOnly>(type: "date", nullable: true),
                    StorageReference = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_EmployeeDocuments_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_EmployeeDocuments_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeeDocuments", x => x.IdEmployeeDocument);
                    table.CheckConstraint("CK_EmployeeDocuments_ExpiryDateRange", "[ExpiresDate] IS NULL OR [IssuedDate] IS NULL OR [ExpiresDate] >= [IssuedDate]");
                    table.ForeignKey(
                        name: "FK_EmployeeDocuments_Employees_IdEmployee",
                        column: x => x.IdEmployee,
                        principalSchema: "dbo",
                        principalTable: "Employees",
                        principalColumn: "IdEmployee",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "EmployeeEvaluations",
                schema: "dbo",
                columns: table => new
                {
                    IdEmployeeEvaluation = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdEmployee = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EvaluationType = table.Column<string>(type: "varchar(50)", unicode: false, maxLength: 50, nullable: false),
                    Result = table.Column<string>(type: "varchar(40)", unicode: false, maxLength: 40, nullable: false),
                    EvaluatedDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ExpiresDate = table.Column<DateOnly>(type: "date", nullable: true),
                    CertificateNumber = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    StorageReference = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_EmployeeEvaluations_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_EmployeeEvaluations_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeeEvaluations", x => x.IdEmployeeEvaluation);
                    table.CheckConstraint("CK_EmployeeEvaluations_ExpiryDateRange", "[ExpiresDate] IS NULL OR [ExpiresDate] >= [EvaluatedDate]");
                    table.ForeignKey(
                        name: "FK_EmployeeEvaluations_Employees_IdEmployee",
                        column: x => x.IdEmployee,
                        principalSchema: "dbo",
                        principalTable: "Employees",
                        principalColumn: "IdEmployee",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ClientContacts",
                schema: "dbo",
                columns: table => new
                {
                    IdClientContact = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdClient = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdClientSite = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Purpose = table.Column<string>(type: "varchar(40)", unicode: false, maxLength: 40, nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    JobTitle = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true),
                    Email = table.Column<string>(type: "varchar(254)", unicode: false, maxLength: 254, nullable: true),
                    Phone = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: true),
                    MobilePhone = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: true),
                    IsPrimary = table.Column<bool>(type: "bit", nullable: false),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_ClientContacts_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_ClientContacts_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientContacts", x => x.IdClientContact);
                    table.ForeignKey(
                        name: "FK_ClientContacts_ClientSites_IdClientSite",
                        column: x => x.IdClientSite,
                        principalSchema: "dbo",
                        principalTable: "ClientSites",
                        principalColumn: "IdClientSite",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ClientContacts_Clients_IdClient",
                        column: x => x.IdClient,
                        principalSchema: "dbo",
                        principalTable: "Clients",
                        principalColumn: "IdClient",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Services",
                schema: "dbo",
                columns: table => new
                {
                    IdService = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdClient = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdClientSite = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdServiceContract = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CodeService = table.Column<string>(type: "varchar(40)", unicode: false, maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    InvoiceDescription = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_Services_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_Services_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Services", x => x.IdService);
                    table.CheckConstraint("CK_Services_DateRange", "[EndDate] IS NULL OR [EndDate] >= [StartDate]");
                    table.ForeignKey(
                        name: "FK_Services_ClientSites_IdClientSite",
                        column: x => x.IdClientSite,
                        principalSchema: "dbo",
                        principalTable: "ClientSites",
                        principalColumn: "IdClientSite",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Services_Clients_IdClient",
                        column: x => x.IdClient,
                        principalSchema: "dbo",
                        principalTable: "Clients",
                        principalColumn: "IdClient",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Services_ServiceContracts_IdServiceContract",
                        column: x => x.IdServiceContract,
                        principalSchema: "dbo",
                        principalTable: "ServiceContracts",
                        principalColumn: "IdServiceContract",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ServiceAssignments",
                schema: "dbo",
                columns: table => new
                {
                    IdServiceAssignment = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdEmployee = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdService = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssignmentType = table.Column<string>(type: "varchar(40)", unicode: false, maxLength: 40, nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: true),
                    IsPrimary = table.Column<bool>(type: "bit", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_ServiceAssignments_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_ServiceAssignments_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceAssignments", x => x.IdServiceAssignment);
                    table.CheckConstraint("CK_ServiceAssignments_DateRange", "[EndDate] IS NULL OR [EndDate] >= [StartDate]");
                    table.ForeignKey(
                        name: "FK_ServiceAssignments_Employees_IdEmployee",
                        column: x => x.IdEmployee,
                        principalSchema: "dbo",
                        principalTable: "Employees",
                        principalColumn: "IdEmployee",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ServiceAssignments_Services_IdService",
                        column: x => x.IdService,
                        principalSchema: "dbo",
                        principalTable: "Services",
                        principalColumn: "IdService",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ServiceConfigurations",
                schema: "dbo",
                columns: table => new
                {
                    IdServiceConfiguration = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    IdService = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EffectiveFromDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EffectiveToDate = table.Column<DateOnly>(type: "date", nullable: true),
                    RequiredWorkerCount = table.Column<short>(type: "smallint", nullable: false),
                    HoursPerDay = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    DaysPerWeek = table.Column<byte>(type: "tinyint", nullable: false),
                    AverageWeeklyHours = table.Column<decimal>(type: "decimal(7,2)", precision: 7, scale: 2, nullable: false),
                    AverageMonthlyHours = table.Column<decimal>(type: "decimal(8,2)", precision: 8, scale: 2, nullable: false),
                    PreparationLeadDays = table.Column<short>(type: "smallint", nullable: false),
                    WorkScheduleDescription = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    SpecificInstructions = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    MonthlyPrice = table.Column<decimal>(type: "decimal(19,4)", precision: 19, scale: 4, nullable: false),
                    CurrencyCode = table.Column<string>(type: "varchar(3)", unicode: false, maxLength: 3, nullable: false, defaultValue: "MXN")
                        .Annotation("Relational:DefaultConstraintName", "DF_ServiceConfigurations_CurrencyCode"),
                    IsTaxIncluded = table.Column<bool>(type: "bit", nullable: false),
                    Active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                        .Annotation("Relational:DefaultConstraintName", "DF_ServiceConfigurations_Active"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                        .Annotation("Relational:DefaultConstraintName", "DF_ServiceConfigurations_CreatedAt"),
                    CreatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    UpdatedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceConfigurations", x => x.IdServiceConfiguration);
                    table.CheckConstraint("CK_ServiceConfigurations_DaysPerWeek", "[DaysPerWeek] BETWEEN 1 AND 7");
                    table.CheckConstraint("CK_ServiceConfigurations_EffectiveDateRange", "[EffectiveToDate] IS NULL OR [EffectiveToDate] >= [EffectiveFromDate]");
                    table.CheckConstraint("CK_ServiceConfigurations_HoursPerDay", "[HoursPerDay] > 0 AND [HoursPerDay] <= 24");
                    table.CheckConstraint("CK_ServiceConfigurations_MonthlyPrice", "[MonthlyPrice] >= 0");
                    table.CheckConstraint("CK_ServiceConfigurations_RequiredWorkerCount", "[RequiredWorkerCount] > 0");
                    table.ForeignKey(
                        name: "FK_ServiceConfigurations_Services_IdService",
                        column: x => x.IdService,
                        principalSchema: "dbo",
                        principalTable: "Services",
                        principalColumn: "IdService",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ClientContacts_IdClient_Purpose",
                schema: "dbo",
                table: "ClientContacts",
                columns: new[] { "IdClient", "Purpose" });

            migrationBuilder.CreateIndex(
                name: "IX_ClientContacts_IdClientSite",
                schema: "dbo",
                table: "ClientContacts",
                column: "IdClientSite");

            migrationBuilder.CreateIndex(
                name: "UX_Clients_IdOrganization_CodeClient",
                schema: "dbo",
                table: "Clients",
                columns: new[] { "IdOrganization", "CodeClient" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_Clients_IdOrganization_Rfc",
                schema: "dbo",
                table: "Clients",
                columns: new[] { "IdOrganization", "Rfc" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_ClientSites_IdClient_CodeClientSite",
                schema: "dbo",
                table: "ClientSites",
                columns: new[] { "IdClient", "CodeClientSite" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeDocuments_IdEmployee_DocumentType",
                schema: "dbo",
                table: "EmployeeDocuments",
                columns: new[] { "IdEmployee", "DocumentType" });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeDocuments_Status_ExpiresDate",
                schema: "dbo",
                table: "EmployeeDocuments",
                columns: new[] { "Status", "ExpiresDate" });

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeEvaluations_EvaluationType_Result_ExpiresDate",
                schema: "dbo",
                table: "EmployeeEvaluations",
                columns: new[] { "EvaluationType", "Result", "ExpiresDate" });

            migrationBuilder.CreateIndex(
                name: "UX_EmployeeEvaluations_IdEmployee_EvaluationType_EvaluatedDate",
                schema: "dbo",
                table: "EmployeeEvaluations",
                columns: new[] { "IdEmployee", "EvaluationType", "EvaluatedDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_Employees_IdOrganization_CodeEmployee",
                schema: "dbo",
                table: "Employees",
                columns: new[] { "IdOrganization", "CodeEmployee" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_Employees_IdOrganization_Curp",
                schema: "dbo",
                table: "Employees",
                columns: new[] { "IdOrganization", "Curp" },
                unique: true,
                filter: "[Curp] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "UX_Employees_IdOrganization_Rfc",
                schema: "dbo",
                table: "Employees",
                columns: new[] { "IdOrganization", "Rfc" },
                unique: true,
                filter: "[Rfc] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "UX_Employees_IdOrganization_SocialSecurityNumber",
                schema: "dbo",
                table: "Employees",
                columns: new[] { "IdOrganization", "SocialSecurityNumber" },
                unique: true,
                filter: "[SocialSecurityNumber] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "UX_Organizations_CodeOrganization",
                schema: "dbo",
                table: "Organizations",
                column: "CodeOrganization",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UX_Organizations_Rfc",
                schema: "dbo",
                table: "Organizations",
                column: "Rfc",
                unique: true,
                filter: "[Rfc] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceAssignments_IdEmployee_StartDate",
                schema: "dbo",
                table: "ServiceAssignments",
                columns: new[] { "IdEmployee", "StartDate" });

            migrationBuilder.CreateIndex(
                name: "IX_ServiceAssignments_IdService_StartDate",
                schema: "dbo",
                table: "ServiceAssignments",
                columns: new[] { "IdService", "StartDate" });

            migrationBuilder.CreateIndex(
                name: "UX_ServiceConfigurations_IdService_EffectiveFromDate",
                schema: "dbo",
                table: "ServiceConfigurations",
                columns: new[] { "IdService", "EffectiveFromDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServiceContracts_IdClient_Status",
                schema: "dbo",
                table: "ServiceContracts",
                columns: new[] { "IdClient", "Status" });

            migrationBuilder.CreateIndex(
                name: "UX_ServiceContracts_IdClient_CodeServiceContract",
                schema: "dbo",
                table: "ServiceContracts",
                columns: new[] { "IdClient", "CodeServiceContract" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Services_IdClientSite",
                schema: "dbo",
                table: "Services",
                column: "IdClientSite");

            migrationBuilder.CreateIndex(
                name: "IX_Services_IdServiceContract",
                schema: "dbo",
                table: "Services",
                column: "IdServiceContract");

            migrationBuilder.CreateIndex(
                name: "UX_Services_IdClient_CodeService",
                schema: "dbo",
                table: "Services",
                columns: new[] { "IdClient", "CodeService" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ClientContacts",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "EmployeeDocuments",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "EmployeeEvaluations",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "ServiceAssignments",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "ServiceConfigurations",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Employees",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Services",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "ClientSites",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "ServiceContracts",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Clients",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Organizations",
                schema: "dbo");
        }
    }
}
