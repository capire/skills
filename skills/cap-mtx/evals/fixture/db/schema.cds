namespace sap.capire.incidents;
using { cuid, managed } from '@sap/cds/common';

entity Incidents : cuid, managed {
  title       : String(100);
  description : String(1000);
  urgency     : String(10) default 'medium';
  status      : String(20) default 'new';
  customer    : Association to Customers;
}

entity Customers : cuid, managed {
  firstName : String(50);
  lastName  : String(50);
  email     : String(100);
  phone     : String(30);
  incidents : Composition of many Incidents on incidents.customer = $self;
}
