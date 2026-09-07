import { MetricEntry, CalculatedMetrics, BusinessType, Client, StatusHealth } from '../types';

export const calculateMetrics = (entry: MetricEntry, type: BusinessType): CalculatedMetrics => {
  const invest = parseFloat(entry.investment as any) || 0;
  const metrics: CalculatedMetrics = {
    roas: 0,
    cac: 0,
    ticket: 0,
    conversion: 0,
  };

  if (invest <= 0) {
    metrics.profit = (entry.revenue || 0) - invest;
    return metrics;
  }

  // Helper to ensure numbers are finite and not NaN
  const safeDiv = (num: number, den: number) => {
    if (!den || den === 0) return 0;
    const res = num / den;
    return isFinite(res) ? res : 0;
  };

  switch (type) {
    case 'SERVICE_BOOKING': {
      const revenue = entry.revenue || 0;
      const sales = entry.sales || 0;
      const leads = entry.leads || 0;
      const bookings = entry.bookings || 0;
      const shows = entry.shows || 0;

      metrics.roas = safeDiv(revenue, invest);
      metrics.cac = sales > 0 ? safeDiv(invest, sales) : 0;
      metrics.ticket = sales > 0 ? safeDiv(revenue, sales) : 0;
      metrics.conversion = leads > 0 ? safeDiv(sales, leads) * 100 : 0;
      metrics.cpl = safeDiv(invest, leads);
      metrics.bookingRate = leads > 0 ? safeDiv(bookings, leads) * 100 : 0;
      metrics.showRate = bookings > 0 ? safeDiv(shows, bookings) * 100 : 0;
      metrics.closeRate = shows > 0 ? safeDiv(sales, shows) * 100 : 0;
      break;
    }

    case 'ECOMMERCE': {
      const revenue = entry.revenue || 0;
      const purchases = entry.purchases || 0;
      const sessions = entry.sessions || 0;
      const addCart = entry.addCart || 0;

      metrics.roas = safeDiv(revenue, invest);
      metrics.cac = purchases > 0 ? safeDiv(invest, purchases) : 0;
      metrics.ticket = purchases > 0 ? safeDiv(revenue, purchases) : 0;
      metrics.conversion = sessions > 0 ? safeDiv(purchases, sessions) * 100 : 0;
      metrics.cpc = safeDiv(invest, sessions);
      metrics.abandonRate = addCart > 0 ? safeDiv(addCart - purchases, addCart) * 100 : 0;
      break;
    }

    case 'B2B_LEADS': {
      const revenue = entry.revenue || 0;
      const sales = entry.sales || 0;
      const leads = entry.leads || 0;
      const mqls = entry.mqls || 0;

      metrics.roas = safeDiv(revenue, invest);
      metrics.cac = sales > 0 ? safeDiv(invest, sales) : 0;
      metrics.ticket = sales > 0 ? safeDiv(revenue, sales) : 0;
      metrics.conversion = leads > 0 ? safeDiv(sales, leads) * 100 : 0;
      metrics.cpl = safeDiv(invest, leads);
      metrics.mqlRate = leads > 0 ? safeDiv(mqls, leads) * 100 : 0;
      break;
    }

    case 'WHATSAPP': {
      const revenue = entry.revenue || 0;
      const sales = entry.sales || 0;
      const clicks = entry.waClicks || 0;
      const convs = entry.waConversations || 0;

      metrics.roas = safeDiv(revenue, invest);
      metrics.cac = sales > 0 ? safeDiv(invest, sales) : 0;
      metrics.ticket = sales > 0 ? safeDiv(revenue, sales) : 0;
      metrics.conversion = clicks > 0 ? safeDiv(sales, clicks) * 100 : 0;
      metrics.cpc = safeDiv(invest, clicks);
      metrics.waResponseRate = clicks > 0 ? safeDiv(convs, clicks) * 100 : 0;
      break;
    }

    case 'REAL_ESTATE': {
      const revenue = entry.revenue || 0;
      const sales = entry.sales || 0;
      const leads = entry.leads || 0;
      const bookings = entry.bookings || 0; // Agendamentos de visita

      metrics.roas = safeDiv(revenue, invest);
      metrics.cac = sales > 0 ? safeDiv(invest, sales) : 0;
      metrics.ticket = sales > 0 ? safeDiv(revenue, sales) : 0;
      metrics.conversion = leads > 0 ? safeDiv(sales, leads) * 100 : 0;
      metrics.cpl = safeDiv(invest, leads);
      metrics.bookingRate = leads > 0 ? safeDiv(bookings, leads) * 100 : 0;
      break;
    }

    case 'INFO_PRODUCTS':
    case 'LAUNCH': {
      const revenue = entry.revenue || 0;
      const sales = entry.sales || 0;
      const leads = entry.leads || 0;
      const clicks = entry.clicks || 0;

      metrics.roas = safeDiv(revenue, invest);
      metrics.cac = sales > 0 ? safeDiv(invest, sales) : 0;
      metrics.ticket = sales > 0 ? safeDiv(revenue, sales) : 0;
      metrics.conversion = leads > 0 ? safeDiv(sales, leads) * 100 : 0;
      metrics.cpl = safeDiv(invest, leads);
      metrics.cpc = safeDiv(invest, clicks);
      metrics.cpm = entry.cpm || 0;
      metrics.clicks = clicks;
      break;
    }

    case 'LOCAL_BUSINESS': {
      const revenue = entry.revenue || 0;
      const sales = entry.sales || 0;
      const leads = entry.leads || 0; // Cliques no botão de direção/whatsapp

      metrics.roas = safeDiv(revenue, invest);
      metrics.cac = sales > 0 ? safeDiv(invest, sales) : 0;
      metrics.ticket = sales > 0 ? safeDiv(revenue, sales) : 0;
      metrics.cpl = safeDiv(invest, leads);
      break;
    }

    case 'VIDEO_PRODUCTION':
    case 'CONTENT_EDITING': {
      const delivered = entry.delivered || 0;
      const projects = entry.projects || entry.raw || entry.leads || 0;
      
      metrics.conversion = projects > 0 ? safeDiv(delivered, projects) * 100 : 0;
      metrics.delivered = delivered;
      metrics.projects = projects;
      break;
    }
  }

  metrics.roi = invest > 0 ? safeDiv((entry.revenue || 0) - invest, invest) * 100 : 0;
  metrics.profit = entry.profit || (entry.revenue || 0) - invest;
  metrics.cac = entry.cac || metrics.cac; // Use manual CAC if provided
  metrics.leads = entry.leads;
  metrics.sales = entry.sales;

  return metrics;
};

export const getHealthStatus = (lastMetrics: CalculatedMetrics, targetRoas: number): StatusHealth => {
  if (lastMetrics.delivered !== undefined) {
    // For creative services, health is based on delivery rate
    if (lastMetrics.conversion >= 80) return 'GOOD';
    if (lastMetrics.conversion >= 50) return 'WARNING';
    return 'CRITICAL';
  }
  
  if (lastMetrics.roas >= targetRoas) return 'GOOD';
  if (lastMetrics.roas >= targetRoas * 0.8) return 'WARNING';
  return 'CRITICAL';
};

export const generateInsights = (current: CalculatedMetrics, previous?: CalculatedMetrics): string[] => {
  const insights: string[] = [];
  
  if (!previous) return ["Dados iniciais coletados. Aguarde o próximo mês para comparativos."];

  if (current.delivered !== undefined && previous.delivered !== undefined) {
    if (current.delivered > previous.delivered) {
      insights.push(`A produção aumentou este mês: ${current.delivered} entregas realizadas.`);
    }
    if (current.conversion > previous.conversion) {
      insights.push(`A eficiência de entrega melhorou em ${(current.conversion - previous.conversion).toFixed(1)}%.`);
    }
    return insights;
  }

  if (current.roas > previous.roas && current.roas > 0) {
    insights.push(`Seu ROAS subiu ${((current.roas / previous.roas - 1) * 100).toFixed(1)}% este mês.`);
  } else if (current.roas < previous.roas && current.roas > 0) {
    insights.push(`Atenção: O ROAS caiu em relação ao mês anterior.`);
  }

  if (current.leads && previous.leads) {
    if (current.leads > previous.leads) {
      insights.push(`Volume de leads aumentou em ${((current.leads / previous.leads - 1) * 100).toFixed(1)}%.`);
    }
    if (current.cpl && previous.cpl) {
      if (current.cpl < previous.cpl) {
        insights.push(`Seu Custo por Lead (CPL) melhorou: R$ ${current.cpl.toFixed(2)}.`);
      } else if (current.cpl > previous.cpl) {
        insights.push(`O CPL subiu este mês. Recomenda-se revisar criativos.`);
      }
    }
  }

  if (current.cac && previous.cac && current.cac < previous.cac) {
    insights.push(`Excelente! Seu custo de aquisição (CAC) diminuiu.`);
  }

  return insights;
};
