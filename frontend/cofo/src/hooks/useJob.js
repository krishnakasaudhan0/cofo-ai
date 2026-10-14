import { useEffect, useState } from "react";

const API_BASE = "http://localhost:3000";

export function useJob(jobId) {
  const [job, setJob] = useState(null);

  useEffect(() => {
    if (!jobId) return;

    const load = () =>
      fetch(`${API_BASE}/api/jobs/${jobId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data && !data.error) setJob(data);
        })
        .catch(console.error);

    load();

    let es;
    let fallbackInterval;

    try {
      es = new EventSource(`${API_BASE}/api/jobs/${jobId}/events`);

      es.onmessage = (m) => {
        try {
          const data = JSON.parse(m.data);
          load();
          if (data.jobStatus) {
            es.close();
          }
        } catch (e) {
          // ignore ping
        }
      };

      es.onerror = () => {
        if (es) es.close();
        fallbackInterval = setInterval(load, 2000);
        setTimeout(() => clearInterval(fallbackInterval), 120000);
      };
    } catch (e) {
      fallbackInterval = setInterval(load, 2000);
      setTimeout(() => clearInterval(fallbackInterval), 120000);
    }

    return () => {
      if (es) es.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [jobId]);

  return job;
}
