// Helper soft delete filter function
export const addSoftDeleteFilter = (include: any): any => 
  Object.entries(include).reduce((acc, [key, value]) => {
    if (typeof value === 'boolean') {
      acc[key] = { where: { deletedAt: null } };
    } else if (value && typeof value === 'object') {
      acc[key] = {
        ...(value as object),
        where: { ...(value as any).where, deletedAt: null },
        ...((value as any).include && { 
          include: addSoftDeleteFilter((value as any).include) 
        })
      };
    }
    return acc;
  }, {} as any);