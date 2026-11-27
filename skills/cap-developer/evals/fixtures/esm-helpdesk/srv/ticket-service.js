import cds from '@sap/cds'

export default class TicketService extends cds.ApplicationService {
  async init () {
    this.before('CREATE', 'Tickets', req => {
      if (!req.data.title) req.reject(400, 'TITLE_REQUIRED')
    })
    return super.init()
  }
}
