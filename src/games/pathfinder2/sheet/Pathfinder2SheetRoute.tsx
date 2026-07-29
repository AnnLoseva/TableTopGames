import Pathfinder2SheetPage from './components/Pathfinder2SheetPage'
import { getPathfinder2RulesCatalog } from './rules-data'

export default function Pathfinder2SheetRoute() {
  return <Pathfinder2SheetPage rules={getPathfinder2RulesCatalog()} />
}
