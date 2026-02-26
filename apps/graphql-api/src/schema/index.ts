import { builder } from "./builder"

// Register types (side-effect imports)
import "./types/user"
import "./types/job"
import "./types/job-run"
import "./types/stats"
import "./queries/index"
import "./mutations/index"

export const schema = builder.toSchema()
