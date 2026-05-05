## Problema

En el diálogo de "Nuevo Contacto" (`ContactFormDialog.tsx`), el selector de Empresa muestra solo una parte de las empresas. La base de datos tiene **1,167 empresas activas**, pero Supabase aplica un límite por defecto de **1,000 filas por consulta**, así que las últimas no aparecen en el listado.

La consulta actual:

```ts
supabase.from("companies").select("id, name").order("name")
```

No usa paginación ni `range`, por lo que se queda corta.

## Solución

Modificar `src/components/ContactFormDialog.tsx` en el `useQuery` de `companies_for_contact` para traer todas las empresas activas usando paginación con `range()` en bucle (1000 filas por página) hasta agotar resultados, y filtrar también por `is_active = true` para no traer registros desactivados.

Pseudocódigo:

```text
let all = []
let from = 0, size = 1000
loop:
  data = companies.select(id,name).eq(is_active,true).order(name).range(from, from+size-1)
  all.push(...data)
  if data.length < size break
  from += size
return all
```

## Alcance

- Archivo único: `src/components/ContactFormDialog.tsx`
- Sin cambios de schema ni de RLS
- Sin afectar otras pantallas (se puede revisar después si otros selectores tienen el mismo problema, pero no se incluye en este cambio)