import { Tag, Tooltip } from "antd";

interface ProjectCellProps {
  projectId: number | null | undefined;
  projectMap: Map<number, string>;
}

// 列表「项目」列单元格：长项目名单行截断 + 省略号，Tooltip 悬停看全名，
// 避免项目名撑破固定列宽后溢出、挤压相邻的「标签」列。
export function ProjectCell({ projectId, projectMap }: ProjectCellProps) {
  if (projectId == null) {
    return <span className="text-xs text-slate-400 dark:text-slate-500">—</span>;
  }
  const name = projectMap.get(projectId);
  return name ? (
    <Tooltip title={name}>
      <Tag color="blue" className="m-0 inline-block max-w-full min-w-0 truncate align-middle">
        {name}
      </Tag>
    </Tooltip>
  ) : (
    <Tooltip title={`项目 ID ${projectId} 已删除`}>
      <span className="text-xs text-amber-500">已删除</span>
    </Tooltip>
  );
}
