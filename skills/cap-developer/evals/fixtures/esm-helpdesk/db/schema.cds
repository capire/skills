namespace helpdesk;

using { cuid } from '@sap/cds/common';

entity Tickets : cuid {
  title    : String;
  archived : Boolean default false;
}
