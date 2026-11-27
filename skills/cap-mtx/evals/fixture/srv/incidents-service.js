const cds = require('@sap/cds')

module.exports = class IncidentsService extends cds.ApplicationService {
  async init() {
    this.before('CREATE', 'Incidents', req => {
      if (!req.data.title) req.reject(400, 'Title is required')
    })
    return super.init()
  }
}
