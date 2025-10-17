import axios from 'axios';

export default class HealthMonitor {
  constructor(serviceMap) {
    this.serviceMap = serviceMap;
    this.statusMap = {};
  }

  async checkAll() {
    const results = {};

    for (const [name, service] of Object.entries(this.serviceMap)) {
      try {
        // development.....
        const res = await axios.get(`http://${service.host}:${service.port}/health`, { timeout: 2000 });
        // production......
        // const res = await axios.get(`https://${service.host}:${service.port}/health`, { timeout: 2000 });
        results[name] = {
          healthy: true,
          lastChecked: new Date(),
          details: res.data
        };
      } catch (err) {
        results[name] = {
          healthy: false,
          lastChecked: new Date(),
          error: err.message
        };
      }
    }

    this.statusMap = results;
    return results;
  }

    // Get the latest status of a specific service
  getStatus(serviceName) {
    return this.statusMap[serviceName] || null;
  }

   // run periodic checks
  // startMonitoring(intervalMs = 30000) { // default every 30s
  startMonitoring(intervalMs = 7200000) { // default every 2hrs
    // run immediately
    this.checkAll();

    // then schedule recurring checks
    this.interval = setInterval(() => {
      this.checkAll().then(results => {
        // console.log(`[HealthMonitor] Refreshed service statuses at ${new Date().toISOString()}`);
         this.printStatuses(results, 'Periodic Check');
      });
    }, intervalMs);
  }

  printStatuses(results, label) {
  const now = new Date();
  const formattedDate = now.toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  }).replace(',', '');
  
  console.log(`\n=== Service Health (${label}) ${formattedDate} ===`);
  for (const [name, status] of Object.entries(results)) {
    console.log(`${name}: ${status.healthy ? '✅ healthy' : '❌ unhealthy'}`);
  }
  console.log('===============================\n');
}

  stopMonitoring() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

}
