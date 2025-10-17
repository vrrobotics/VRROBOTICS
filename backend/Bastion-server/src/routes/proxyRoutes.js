import { Router } from 'express';
import httpProxy from 'express-http-proxy';
import serviceMap from '../utils/serviceMap.js';
import HealthMonitor from '../utils/healthMonitor.js';

const router = Router();
const healthMonitor = new HealthMonitor(serviceMap);

// run checks automatically every 2hrs
healthMonitor.startMonitoring(7200000);
// healthMonitor.startMonitoring(30000); // every 30s for demo

// Run health check once on startup
(async () => {
  const results = await healthMonitor.checkAll();
  console.log('=== Service Health on Startup ===');
  for (const [name, status] of Object.entries(results)) {
    console.log(`${name}: ${status.healthy ? '✅ healthy' : '❌ unhealthy'}`);
  }
  console.log('=================================');
})();

Object.entries(serviceMap).forEach(([name, service]) => {
  // development.....
  const target = `http://${service.host}:${service.port}`;
  // production......
  // const target = `https://${service.host}:${service.port}`;
  const proxy = httpProxy(target, {
    preserveHostHdr: true,
    proxyReqPathResolver: (req) => req.originalUrl.replace(`/api/v1/${service.path}`, '') || '/'
  });

  router.use(`/v1/${service.path}`, (req, res, next) => {
    const status = healthMonitor.getStatus(name);

    if (!status || !status.healthy) {
      console.warn(`[Bastion] ${service.path} is DOWN (last checked: ${status.lastChecked})`);
      return res.status(503).json({
        error: `${service.path} unavailable`,
        lastChecked: status.lastChecked,
        details: status.error || 'No response from service'
      });
    }

    console.log(`[Bastion] Forwarding ${req.method} ${req.originalUrl} → ${target}`);
    proxy(req, res, next);
  });
});

// expose Bastion’s view of service health
router.get('/_services/health', (req, res) => {
  res.json(healthMonitor.statusMap);
});

export default router;
