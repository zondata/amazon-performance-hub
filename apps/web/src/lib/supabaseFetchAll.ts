import 'server-only';

type FetchPage<T> = (
  from: number,
  to: number
) => Promise<{ data: T[] | null; error: { message: string } | null }> | unknown;

export const fetchAllRows = async <T>(
  fetchPage: FetchPage<T>,
  pageSize = 1000
): Promise<T[]> => {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const result = (await fetchPage(from, from + pageSize - 1)) as {
      data: T[] | null;
      error: { message: string } | null;
    };
    const { data, error } = result;
    if (error) {
      throw new Error(error.message);
    }
    if (!data || data.length === 0) {
      break;
    }
    rows.push(...data);
    if (data.length < pageSize) {
      break;
    }
    from += pageSize;
  }

  return rows;
};
