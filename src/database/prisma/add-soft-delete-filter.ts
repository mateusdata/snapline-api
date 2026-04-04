export const addSoftDeleteFilter = (include: any): any => 
  Object.entries(include).reduce((acc, [key, value]) => {
    if (typeof value === 'boolean') {
      acc[key] = value;
    } else if (value && typeof value === 'object') {
      const val = value as any;
      acc[key] = {
        ...val,
        // Só adiciona where se tiver 'where' ou 'take' (sinal de to-many)
        ...(val.where !== undefined || val.take !== undefined 
          ? { where: { ...val.where, deletedAt: null } } 
          : {}),
        ...(val.include && { 
          include: addSoftDeleteFilter(val.include) 
        })
      };
    }
    return acc;
  }, {} as any);