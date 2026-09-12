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
    Nationality
}
