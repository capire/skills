using { sap.travel as travel } from '../db/schema';
using { sap.capire.xflights as x } from '../apis/xflights';

service TravelService {
  entity Bookings as projection on travel.Bookings;
  entity Orders   as projection on travel.Orders;
  @readonly entity Flights as projection on x.Flights;
}
