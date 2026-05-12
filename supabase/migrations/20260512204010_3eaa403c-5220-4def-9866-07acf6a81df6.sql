UPDATE public.documentos
SET is_active = false,
    notas = COALESCE(notas, '') || E'\n[Auto-limpieza 2026-05-12] Duplicado de pedido ya entregado/programado en ruta. Desactivado del pool.'
WHERE id IN (
  '3c30e5ec-03b0-4568-83f3-c8ee5d3b6776',
  'e9c95287-b997-42a7-93a9-5337e14e788a',
  '293b0707-16c4-4db2-952f-45bf7eff647d',
  '401ed0ab-82a1-4bc1-a38e-2240ab41fecf',
  '1662cf7b-59ff-44c1-b1f8-b3ed2a2141a7',
  'e5279e2b-a1d3-41a2-9bb3-4d31eac49352',
  'dd0ca70a-264a-49cc-8386-7038cc98e953',
  '3e1f70af-7ca1-49b0-abb6-237d3d958e62',
  'de7b3ba1-b1d2-4ae1-8ee8-b6d659c15bdd',
  'e2f2da2b-d97a-4174-b1c9-84a9831a6417',
  'aaf3d4b3-5eb4-4149-a8a0-1c34cae1d8cc',
  'c634ddd0-19cc-44e9-a77e-7ae7e1fc8823',
  '9ef84843-847f-445c-b88a-a0822a92f1b9',
  '892f70e5-05c1-491f-84a8-6564890f0f99',
  '9ff4ac43-9183-4d89-a2e3-62110ba3c8c0',
  '24bdd75c-f088-480f-8d4d-51f93b7f8886',
  '3a2f36f1-1309-44b7-bbd9-80151488277c',
  'b92f83b4-0d45-4386-aef8-e7df24d8133a',
  'd7c36c32-e692-4bf5-a5be-1707cebad6c4',
  'ee05ff76-7cb4-4ad5-abf6-47374f602f37',
  '8deddcba-8a83-4633-9315-34be7d2e1136',
  '861d14dd-64f8-4662-a7ed-2184b366db11'
);