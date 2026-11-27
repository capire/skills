using { helpdesk as db } from '../db/schema';

service TicketService {
  entity Tickets as projection on db.Tickets;
}
