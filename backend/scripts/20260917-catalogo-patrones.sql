BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260917044429_AddShiftPatternTemplateCatalog'
)
BEGIN
    ALTER TABLE [dbo].[Positions] ADD [IdShiftPatternTemplate] uniqueidentifier NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260917044429_AddShiftPatternTemplateCatalog'
)
BEGIN
    CREATE TABLE [dbo].[ShiftPatternTemplates] (
        [IdShiftPatternTemplate] uniqueidentifier NOT NULL,
        [IdOrganization] uniqueidentifier NOT NULL,
        [Name] nvarchar(150) NOT NULL,
        [NormalizedName] nvarchar(150) NOT NULL,
        [Description] nvarchar(1000) NULL,
        [Daypart] varchar(20) NOT NULL,
        [CycleDays] int NOT NULL,
        [EffectiveFromDate] date NOT NULL,
        [EffectiveToDate] date NULL,
        [Active] bit NOT NULL CONSTRAINT [DF_ShiftPatternTemplates_Active] DEFAULT CAST(1 AS bit),
        [CreatedAt] datetime2(0) NOT NULL CONSTRAINT [DF_ShiftPatternTemplates_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [CreatedBy] uniqueidentifier NOT NULL,
        [CreatedByName] nvarchar(100) NOT NULL,
        [UpdatedAt] datetime2(0) NULL,
        [UpdatedBy] uniqueidentifier NULL,
        [UpdatedByName] nvarchar(100) NULL,
        CONSTRAINT [PK_ShiftPatternTemplates] PRIMARY KEY ([IdShiftPatternTemplate]),
        CONSTRAINT [CK_ShiftPatternTemplates_CycleDays] CHECK ([CycleDays] BETWEEN 1 AND 366),
        CONSTRAINT [CK_ShiftPatternTemplates_DateRange] CHECK ([EffectiveToDate] IS NULL OR [EffectiveToDate] >= [EffectiveFromDate]),
        CONSTRAINT [FK_ShiftPatternTemplates_Organizations_IdOrganization] FOREIGN KEY ([IdOrganization]) REFERENCES [dbo].[Organizations] ([IdOrganization]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260917044429_AddShiftPatternTemplateCatalog'
)
BEGIN
    CREATE TABLE [dbo].[ShiftPatternTemplateDays] (
        [IdShiftPatternTemplateDay] uniqueidentifier NOT NULL,
        [IdOrganization] uniqueidentifier NOT NULL,
        [IdShiftPatternTemplate] uniqueidentifier NOT NULL,
        [CycleDayNumber] int NOT NULL,
        [StartTime] time(0) NULL,
        [EndTime] time(0) NULL,
        [IsRest] bit NOT NULL,
        [DurationMinutes] int NOT NULL,
        [IsOvernight] bit NOT NULL,
        [Active] bit NOT NULL CONSTRAINT [DF_ShiftPatternTemplateDays_Active] DEFAULT CAST(1 AS bit),
        [CreatedAt] datetime2(0) NOT NULL CONSTRAINT [DF_ShiftPatternTemplateDays_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [CreatedBy] uniqueidentifier NOT NULL,
        [CreatedByName] nvarchar(100) NOT NULL,
        [UpdatedAt] datetime2(0) NULL,
        [UpdatedBy] uniqueidentifier NULL,
        [UpdatedByName] nvarchar(100) NULL,
        CONSTRAINT [PK_ShiftPatternTemplateDays] PRIMARY KEY ([IdShiftPatternTemplateDay]),
        CONSTRAINT [CK_ShiftPatternTemplateDays_CycleDayNumber] CHECK ([CycleDayNumber] >= 1),
        CONSTRAINT [CK_ShiftPatternTemplateDays_RestHasNoSchedule] CHECK (([IsRest] = CAST(1 AS bit) AND [StartTime] IS NULL AND [EndTime] IS NULL AND [DurationMinutes] = 0) OR ([IsRest] = CAST(0 AS bit) AND [StartTime] IS NOT NULL AND [EndTime] IS NOT NULL AND [DurationMinutes] > 0)),
        CONSTRAINT [FK_ShiftPatternTemplateDays_ShiftPatternTemplates_IdShiftPatternTemplate] FOREIGN KEY ([IdShiftPatternTemplate]) REFERENCES [dbo].[ShiftPatternTemplates] ([IdShiftPatternTemplate]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260917044429_AddShiftPatternTemplateCatalog'
)
BEGIN
    CREATE UNIQUE INDEX [UX_ShiftPatternTemplateDays_IdShiftPatternTemplate_CycleDayNumber] ON [dbo].[ShiftPatternTemplateDays] ([IdShiftPatternTemplate], [CycleDayNumber]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260917044429_AddShiftPatternTemplateCatalog'
)
BEGIN
    CREATE UNIQUE INDEX [UX_ShiftPatternTemplates_IdOrganization_NormalizedName] ON [dbo].[ShiftPatternTemplates] ([IdOrganization], [NormalizedName]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260917044429_AddShiftPatternTemplateCatalog'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260917044429_AddShiftPatternTemplateCatalog', N'10.0.10');
END;

COMMIT;
GO

