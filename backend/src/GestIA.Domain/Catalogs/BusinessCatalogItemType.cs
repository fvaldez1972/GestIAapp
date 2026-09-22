namespace GestIA.Domain.Catalogs;

public enum BusinessCatalogItemType
{
    Skill,
    JobPosition,

    IncidentReason,
    CoverageReason,

    /// <summary>
    /// De que es cada documento de un cliente: acta constitutiva, poder notarial, comprobante de
    /// domicilio, contrato firmado. Es catalogo y no texto libre para que dos personas no escriban
    /// la misma categoria de dos formas y el expediente quede sin poder agruparse.
    /// </summary>
    ClientDocumentCategory,

    Country,
    State,
    City,
    Nationality,

    /// <summary>
    /// De qué es cada documento del personal: INE, CURP, comprobante de domicilio, constancia de
    /// antecedentes.
    ///
    /// <para>Existía como <c>EmployeeDocumentType</c>, un enum de catorce valores fijos, y la matriz
    /// del 19 de septiembre de 2026 lo pidió editable por organización. Una organización que exige
    /// un papel que el enum no contempla no podía registrarlo sin una migración.</para>
    /// </summary>
    EmployeeDocumentCategory,

    /// <summary>
    /// El agrupador de las categorías de documento del personal: Identidad, Fiscal, Domicilio.
    ///
    /// <para><b>Es un catálogo aparte y no una entrada padre dentro del mismo</b>, aunque la tabla
    /// admita las dos formas. Si el grupo y el tipo compartieran tipo de catálogo, un selector de
    /// «tipo de documento» tendría que distinguirlos por si llevan padre o no, y una lista recién
    /// creada —donde nada tiene padre todavía— sería ambigua. Con dos tipos distintos, cada
    /// selector pide lo suyo y no hay nada que adivinar.</para>
    ///
    /// <para>El grupo es <b>opcional</b>: un tipo de documento sin grupo es válido, y es como nacen
    /// los catorce que venían del enum hasta que alguien los agrupe.</para>
    /// </summary>
    EmployeeDocumentGroup,

    /// <summary>
    /// Qué evaluación se le practica a una persona: polígrafo, socioeconómico, antidoping.
    /// Editable por la misma razón que la categoría de documento.
    /// </summary>
    EmployeeEvaluationCategory,

    /// <summary>De qué es una incidencia administrativa: acta administrativa, llamada de atención.</summary>
    AdministrativeIncidentType,

    /// <summary>
    /// El sexo que una posición requiere. Es del <b>puesto</b>, no de la persona: describe lo que el
    /// cliente pide, y por eso admite valores como «Indistinto» que no describirían a nadie.
    /// </summary>
    Sex,

    /// <summary>Rangos de edad que una posición admite, por ejemplo «31 a 50 años».</summary>
    AgeRange,

    /// <summary>Niveles de escolaridad: primaria, secundaria, preparatoria.</summary>
    EducationLevel,

    /// <summary>Equipo que el cliente pide que traiga el personal: radio, arma corta, vehículo.</summary>
    RequiredEquipment,

    /// <summary>
    /// El puesto de un contacto del cliente.
    ///
    /// <para><b>Es un catálogo aparte del de puestos del personal, y no por simetría.</b> Hasta hoy
    /// el contacto elegía del catálogo <c>JobPosition</c>, que es el que sostiene la elegibilidad:
    /// dar de alta al vuelo un «Gerente de compras» desde la ficha de un cliente metía ese valor en
    /// la lista contra la que se comprueba si un guardia puede cubrir un turno.</para>
    /// </summary>
    ContactJobPosition,

    /// <summary>
    /// Para qué se le llama a un contacto: administrativo, facturación, emergencia.
    ///
    /// <para>Era el enum <c>ClientContactPurpose</c> con ocho valores. Pasa a catálogo por la
    /// decisión D-03: una lista fija obligaba a una migración cada vez que apareciera un propósito
    /// nuevo.</para>
    /// </summary>
    ContactPurpose
}
