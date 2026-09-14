export function mapRequiredId(idMap: Map<number, number>, oldId: number, tableName: string, fieldName: string): number {
  const newId = idMap.get(oldId);
  if (newId === undefined) {
    throw new Error(`ID mapping gagal: ${tableName}.${fieldName} ID lama ${oldId} tidak ditemukan di peta`);
  }
  return newId;
}

export function mapOptionalId(idMap: Map<number, number>, oldId: number | null | undefined): number | null {
  if (oldId == null) return null;
  return idMap.get(oldId) ?? null;
}
