using { sap.capire.incidents as my } from '../db/schema';

service IncidentsService {
  entity Incidents as projection on my.Incidents;
  entity Customers as projection on my.Customers;
}
