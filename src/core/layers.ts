export const MAP_LAYERS = [
  { id: 'demand', color: '#5bff83', legend: 'layerDemand', value: 'layerDemandValue' },
  { id: 'load', color: '#40dcff', legend: 'layerLoad', value: 'layerLoadValue' },
  { id: 'complaints', color: '#ff784d', legend: 'layerComplaints', value: 'layerComplaintsValue' },
] as const;
export type Layer = typeof MAP_LAYERS[number]['id'];
