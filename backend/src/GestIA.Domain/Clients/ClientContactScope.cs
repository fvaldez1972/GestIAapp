namespace GestIA.Domain.Clients;

/// <summary>
/// A quién cubre un contacto del cliente.
///
/// <para><b>Se podía deducir de si el contacto tiene zona, y aun así se guarda.</b> Deducirlo
/// funcionaba mientras nadie tuviera que decidirlo: un contacto sin zona era «del cliente» porque
/// no se le había puesto ninguna, que no es lo mismo que porque alguien decidiera que valía para
/// todas. La diferencia se vuelve visible con la decisión D-02 —un contacto principal por
/// alcance—, donde hay que contar cuántos principales hay <b>de cada clase</b> y un nulo
/// ambiguo no sirve para contar.</para>
/// </summary>
public enum ClientContactScope
{
    /// <summary>Vale para todo el cliente. No lleva zona.</summary>
    General,

    /// <summary>Es de una zona concreta, y esa zona tiene que ser del mismo cliente.</summary>
    Zone
}
