namespace sap.travel;
using { cuid, managed } from '@sap/cds/common';
using { sap.capire.xflights as x } from '../apis/xflights';

entity Bookings : cuid, managed {
  title      : String(100);
  startDate  : Date;
  endDate    : Date;
  totalPrice : Decimal(10,2);
  currency   : String(3);
  status     : String(1) default 'O';
  Flight     : Association to x.Flights;
}

entity Orders : cuid, managed {
  description : String(200);
  quantity    : Integer;
  price       : Decimal(10,2);
  customer    : String(100);
}
