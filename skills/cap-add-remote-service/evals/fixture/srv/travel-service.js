const cds = require('@sap/cds')

module.exports = class TravelService extends cds.ApplicationService {
  async init() {
    const xflights = await cds.connect.to('sap.capire.flights.data')
    const { Flights } = cds.entities('sap.capire.xflights')

    // Delegate standalone Flights reads (e.g. value helps) to the remote service
    this.on('READ', this.entities.Flights, req => xflights.run(req.query))

    // Replicate Flights into the local DB on startup so SQL JOINs with Bookings work.
    // Uses modifiedAt for delta sync: only fetches records newer than what we have.
    this.on('served', async () => {
      try {
        const { latest } = await SELECT.one`max(modifiedAt) as latest`.from(Flights)
        const touched = await xflights.read(Flights).where`modifiedAt > ${latest || 0}`
        if (touched.length) {
          await UPSERT(touched).into(Flights)
          console.log(`[TravelService] Replicated ${touched.length} flight(s) into local DB`)
        } else {
          console.log('[TravelService] Flights replication: no new records')
        }
      } catch (err) {
        console.warn('[TravelService] Flights replication failed:', err.message)
      }
    })

    return super.init()
  }
}
