// Consumption view for @capire/xflights-data
// Projects only the columns present in the mock CSV data:
//   ID, date, departure, arrival, airline_ID, modifiedAt
// Annotated with @cds.persistence.table so CAP replicates this into the local DB,
// enabling SQL JOINs with local Bookings records.

using { sap.capire.flights.data as x } from '@capire/xflights-data';
namespace sap.capire.xflights;

@federated
@cds.persistence.table
entity Flights as projection on x.Flights {
  ID,
  date,
  departure,
  arrival,
  modifiedAt,
  airline.name as airline,
}
