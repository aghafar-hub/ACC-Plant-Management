// GENERATED FILE - do not edit by hand.
// Source: schema/tables.json. Regenerate with: node tools/gen-apps-script-schema.mjs
var SCHEMA = {
 "version": 7,
 "tableOrder": [
  "lines",
  "areas",
  "equipment",
  "equipment_areas",
  "equipment_aliases",
  "classifications",
  "reasons",
  "upload_batches",
  "events",
  "event_edits",
  "upload_warnings",
  "roles",
  "users",
  "tab_access",
  "settings",
  "audit_log",
  "notifications",
  "notification_state",
  "notification_prefs",
  "actions",
  "action_log",
  "action_tasks",
  "contractors",
  "area_targets",
  "task_templates",
  "task_template_steps",
  "user_activity",
  "shifts",
  "shift_reports",
  "shift_stoppages",
  "shift_stoppage_edits",
  "workflow_log",
  "responsibilities",
  "kpi_definitions",
  "kpi_targets",
  "production_metrics",
  "production_values",
  "production_corrections",
  "dcs_import_batches",
  "quality_parameters",
  "quality_results",
  "check_rules",
  "data_checks",
  "month_closings"
 ],
 "tables": {
  "lines": {
   "description": "Reporting lines taken from the downtime sheet.",
   "key": [
    "line_id"
   ],
   "columns": [
    {
     "name": "line_id",
     "type": "text",
     "required": true
    },
    {
     "name": "name",
     "type": "text",
     "required": true
    },
    {
     "name": "sort_order",
     "type": "int",
     "required": true
    },
    {
     "name": "active",
     "type": "bool",
     "required": true
    }
   ]
  },
  "areas": {
   "description": "Downtime areas (the EQUIPMENT column of the downtime sheet).",
   "key": [
    "area_id"
   ],
   "columns": [
    {
     "name": "area_id",
     "type": "text",
     "required": true
    },
    {
     "name": "name",
     "type": "text",
     "required": true
    },
    {
     "name": "line_id",
     "type": "text",
     "required": true
    },
    {
     "name": "sort_order",
     "type": "int",
     "required": true
    },
    {
     "name": "active",
     "type": "bool",
     "required": true
    },
    {
     "name": "in_downtime_sheet",
     "type": "bool",
     "required": true
    },
    {
     "name": "notes",
     "type": "text",
     "required": false
    }
   ]
  },
  "equipment": {
   "description": "Equipment master. Seeded from the platform master plus codes found in the downtime lists.",
   "key": [
    "equipment_id"
   ],
   "columns": [
    {
     "name": "equipment_id",
     "type": "text",
     "required": true
    },
    {
     "name": "description",
     "type": "text",
     "required": false
    },
    {
     "name": "equipment_type",
     "type": "text",
     "required": false
    },
    {
     "name": "criticality",
     "type": "text",
     "required": false
    },
    {
     "name": "parent_id",
     "type": "text",
     "required": false
    },
    {
     "name": "status",
     "type": "enum",
     "required": true,
     "enum": [
      "Active",
      "Retired"
     ]
    },
    {
     "name": "origin",
     "type": "text",
     "required": false
    },
    {
     "name": "platform_plant_area",
     "type": "text",
     "required": false
    },
    {
     "name": "platform_main_area",
     "type": "text",
     "required": false
    },
    {
     "name": "platform_sub_area",
     "type": "text",
     "required": false
    },
    {
     "name": "needs_review",
     "type": "bool",
     "required": true
    },
    {
     "name": "review_note",
     "type": "text",
     "required": false
    },
    {
     "name": "created_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "updated_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "updated_by",
     "type": "text",
     "required": false
    }
   ]
  },
  "equipment_areas": {
   "description": "Which areas a code belongs to. A code may belong to several areas.",
   "key": [
    "equipment_id",
    "area_id"
   ],
   "columns": [
    {
     "name": "equipment_id",
     "type": "text",
     "required": true
    },
    {
     "name": "area_id",
     "type": "text",
     "required": true
    }
   ]
  },
  "equipment_aliases": {
   "description": "Typos and retired codes mapped to the canonical code.",
   "key": [
    "alias"
   ],
   "columns": [
    {
     "name": "alias",
     "type": "text",
     "required": true
    },
    {
     "name": "equipment_id",
     "type": "text",
     "required": true
    },
    {
     "name": "reason",
     "type": "text",
     "required": false
    }
   ]
  },
  "classifications": {
   "description": "Stoppage classifications.",
   "key": [
    "code"
   ],
   "columns": [
    {
     "name": "code",
     "type": "text",
     "required": true
    },
    {
     "name": "name",
     "type": "text",
     "required": true
    },
    {
     "name": "is_incident",
     "type": "bool",
     "required": true
    },
    {
     "name": "sort_order",
     "type": "int",
     "required": true
    }
   ]
  },
  "reasons": {
   "description": "Reasons listed per classification, kept exactly as in the downtime value list.",
   "key": [
    "reason_id"
   ],
   "columns": [
    {
     "name": "reason_id",
     "type": "text",
     "required": true
    },
    {
     "name": "classification",
     "type": "text",
     "required": true
    },
    {
     "name": "text_as_listed",
     "type": "text",
     "required": true
    },
    {
     "name": "match_key",
     "type": "text",
     "required": true
    },
    {
     "name": "order_no",
     "type": "int",
     "required": true
    },
    {
     "name": "active",
     "type": "bool",
     "required": true
    }
   ]
  },
  "upload_batches": {
   "description": "One row per upload.",
   "key": [
    "batch_id"
   ],
   "columns": [
    {
     "name": "batch_id",
     "type": "text",
     "required": true
    },
    {
     "name": "uploaded_by",
     "type": "text",
     "required": true
    },
    {
     "name": "uploaded_at",
     "type": "timestamp",
     "required": true
    },
    {
     "name": "file_name",
     "type": "text",
     "required": false
    },
    {
     "name": "file_hash",
     "type": "text",
     "required": false
    },
    {
     "name": "rows_read",
     "type": "int",
     "required": true
    },
    {
     "name": "rows_added",
     "type": "int",
     "required": true
    },
    {
     "name": "rows_identical",
     "type": "int",
     "required": true
    },
    {
     "name": "rows_skipped",
     "type": "int",
     "required": true
    },
    {
     "name": "warning_count",
     "type": "int",
     "required": true
    },
    {
     "name": "status",
     "type": "enum",
     "required": true,
     "enum": [
      "Started",
      "Completed",
      "Failed"
     ]
    },
    {
     "name": "kind",
     "type": "enum",
     "required": false,
     "enum": [
      "monthly",
      "history"
     ]
    }
   ]
  },
  "events": {
   "description": "One row per downtime record (one row of the downtime sheet). Freq, criticality and is_failure are sheet values.",
   "key": [
    "event_id"
   ],
   "columns": [
    {
     "name": "event_id",
     "type": "text",
     "required": true
    },
    {
     "name": "batch_id",
     "type": "text",
     "required": true
    },
    {
     "name": "event_date",
     "type": "date",
     "required": true
    },
    {
     "name": "line_id",
     "type": "text",
     "required": true
    },
    {
     "name": "area_id",
     "type": "text",
     "required": true
    },
    {
     "name": "code_raw",
     "type": "text",
     "required": true
    },
    {
     "name": "equipment_id",
     "type": "text",
     "required": false
    },
    {
     "name": "is_area_level",
     "type": "bool",
     "required": true
    },
    {
     "name": "stop_ts",
     "type": "timestamp",
     "required": true
    },
    {
     "name": "start_ts",
     "type": "timestamp",
     "required": true
    },
    {
     "name": "duration_s",
     "type": "float",
     "required": true
    },
    {
     "name": "freq",
     "type": "int",
     "required": true
    },
    {
     "name": "classification",
     "type": "text",
     "required": true
    },
    {
     "name": "criticality",
     "type": "enum",
     "required": true,
     "enum": [
      "INC",
      "NO_INC"
     ]
    },
    {
     "name": "is_failure",
     "type": "bool",
     "required": true
    },
    {
     "name": "reason_raw",
     "type": "text",
     "required": false
    },
    {
     "name": "reason_id",
     "type": "text",
     "required": false
    },
    {
     "name": "description",
     "type": "text",
     "required": false
    },
    {
     "name": "source_file",
     "type": "text",
     "required": false
    },
    {
     "name": "source_row",
     "type": "int",
     "required": false
    },
    {
     "name": "fingerprint",
     "type": "text",
     "required": true
    },
    {
     "name": "flags",
     "type": "text",
     "required": false
    },
    {
     "name": "edited",
     "type": "bool",
     "required": true
    },
    {
     "name": "is_void",
     "type": "bool",
     "required": true
    },
    {
     "name": "created_at",
     "type": "timestamp",
     "required": true
    },
    {
     "name": "accepted_flags",
     "type": "text",
     "required": false
    },
    {
     "name": "accepted_by",
     "type": "text",
     "required": false
    },
    {
     "name": "accepted_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "origin",
     "type": "enum",
     "required": false,
     "enum": [
      "upload",
      "shift",
      "history"
     ]
    },
    {
     "name": "time_precision",
     "type": "enum",
     "required": false,
     "enum": [
      "exact",
      "day"
     ]
    },
    {
     "name": "shift_stop_id",
     "type": "text",
     "required": false
    }
   ]
  },
  "event_edits": {
   "description": "One row per changed field when an event is edited or voided in the app. Keeps the original value.",
   "key": [
    "edit_id"
   ],
   "columns": [
    {
     "name": "edit_id",
     "type": "text",
     "required": true
    },
    {
     "name": "event_id",
     "type": "text",
     "required": true
    },
    {
     "name": "edited_at",
     "type": "timestamp",
     "required": true
    },
    {
     "name": "edited_by",
     "type": "text",
     "required": true
    },
    {
     "name": "field",
     "type": "text",
     "required": true
    },
    {
     "name": "old_value",
     "type": "text",
     "required": false
    },
    {
     "name": "new_value",
     "type": "text",
     "required": false
    },
    {
     "name": "note",
     "type": "text",
     "required": false
    }
   ]
  },
  "upload_warnings": {
   "description": "Warnings raised by an upload, with the user's decision.",
   "key": [
    "warning_id"
   ],
   "columns": [
    {
     "name": "warning_id",
     "type": "text",
     "required": true
    },
    {
     "name": "batch_id",
     "type": "text",
     "required": true
    },
    {
     "name": "type",
     "type": "enum",
     "required": true,
     "enum": [
      "late_row",
      "changed_row",
      "missing_row",
      "unknown_code",
      "code_not_in_area",
      "unlisted_reason",
      "blank_reason",
      "end_before_start",
      "duration_mismatch",
      "orphan_continuation",
      "overlap_in_area",
      "placeholder_code",
      "edited_in_app",
      "missing_code",
      "missing_classification",
      "invalid_classification",
      "unknown_area",
      "line_mismatch",
      "late_month"
     ]
    },
    {
     "name": "source_row",
     "type": "int",
     "required": false
    },
    {
     "name": "event_id",
     "type": "text",
     "required": false
    },
    {
     "name": "detail",
     "type": "text",
     "required": false
    },
    {
     "name": "resolution",
     "type": "enum",
     "required": false,
     "enum": [
      "added",
      "skipped",
      "kept_stored",
      "accepted"
     ]
    },
    {
     "name": "resolved_by",
     "type": "text",
     "required": false
    }
   ]
  },
  "roles": {
   "description": "User roles.",
   "key": [
    "role_id"
   ],
   "columns": [
    {
     "name": "role_id",
     "type": "text",
     "required": true
    },
    {
     "name": "name",
     "type": "text",
     "required": true
    },
    {
     "name": "description",
     "type": "text",
     "required": false
    }
   ]
  },
  "users": {
   "description": "App accounts. Created by an admin; empty in the delivered database (the first admin is created by the setup function).",
   "key": [
    "user_id"
   ],
   "columns": [
    {
     "name": "user_id",
     "type": "text",
     "required": true
    },
    {
     "name": "email",
     "type": "text",
     "required": true
    },
    {
     "name": "display_name",
     "type": "text",
     "required": true
    },
    {
     "name": "role_id",
     "type": "text",
     "required": true
    },
    {
     "name": "password_hash",
     "type": "text",
     "required": true
    },
    {
     "name": "password_salt",
     "type": "text",
     "required": true
    },
    {
     "name": "hash_rounds",
     "type": "int",
     "required": true
    },
    {
     "name": "must_change",
     "type": "bool",
     "required": true
    },
    {
     "name": "active",
     "type": "bool",
     "required": true
    },
    {
     "name": "failed_attempts",
     "type": "int",
     "required": true
    },
    {
     "name": "locked_until",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "created_at",
     "type": "timestamp",
     "required": true
    },
    {
     "name": "last_login_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "created_by",
     "type": "text",
     "required": false
    }
   ]
  },
  "tab_access": {
   "description": "Tab level per role, with optional per-user overrides. A user override wins over the role.",
   "key": [
    "subject_type",
    "subject_id",
    "tab_id"
   ],
   "columns": [
    {
     "name": "subject_type",
     "type": "enum",
     "required": true,
     "enum": [
      "role",
      "user"
     ]
    },
    {
     "name": "subject_id",
     "type": "text",
     "required": true
    },
    {
     "name": "tab_id",
     "type": "enum",
     "required": true,
     "enum": [
      "overview",
      "pareto",
      "repeats",
      "reliability",
      "reports",
      "actions",
      "events",
      "upload",
      "master",
      "settings",
      "users"
     ]
    },
    {
     "name": "level",
     "type": "enum",
     "required": true,
     "enum": [
      "Hidden",
      "View",
      "Edit"
     ]
    }
   ]
  },
  "settings": {
   "description": "Admin-adjustable settings.",
   "key": [
    "key"
   ],
   "columns": [
    {
     "name": "key",
     "type": "text",
     "required": true
    },
    {
     "name": "value",
     "type": "text",
     "required": false
    },
    {
     "name": "description",
     "type": "text",
     "required": false
    },
    {
     "name": "updated_by",
     "type": "text",
     "required": false
    },
    {
     "name": "updated_at",
     "type": "timestamp",
     "required": false
    }
   ]
  },
  "audit_log": {
   "description": "Append-only log of every change.",
   "key": [],
   "columns": [
    {
     "name": "at",
     "type": "timestamp",
     "required": true
    },
    {
     "name": "user_id",
     "type": "text",
     "required": false
    },
    {
     "name": "action",
     "type": "text",
     "required": true
    },
    {
     "name": "entity",
     "type": "text",
     "required": false
    },
    {
     "name": "entity_id",
     "type": "text",
     "required": false
    },
    {
     "name": "detail",
     "type": "text",
     "required": false
    }
   ]
  },
  "notifications": {
   "description": "Stored alerts and updates (docs/notifications-design.md). Action items are derived live by the app and are never stored. Written by the server only.",
   "key": [
    "notification_id"
   ],
   "columns": [
    {
     "name": "notification_id",
     "type": "text",
     "required": true
    },
    {
     "name": "type",
     "type": "enum",
     "required": true,
     "enum": [
      "long_stop",
      "repeat_group",
      "failure_spike",
      "availability_low",
      "upload_gap",
      "upload_done",
      "user_event",
      "planned_overrun",
      "action_due",
      "action_ready_to_close",
      "task_overdue"
     ]
    },
    {
     "name": "severity",
     "type": "enum",
     "required": true,
     "enum": [
      "alert",
      "update"
     ]
    },
    {
     "name": "dedupe_key",
     "type": "text",
     "required": true
    },
    {
     "name": "title",
     "type": "text",
     "required": true
    },
    {
     "name": "detail",
     "type": "text",
     "required": false
    },
    {
     "name": "area_id",
     "type": "text",
     "required": false
    },
    {
     "name": "line_id",
     "type": "text",
     "required": false
    },
    {
     "name": "source_ref",
     "type": "text",
     "required": false
    },
    {
     "name": "created_at",
     "type": "timestamp",
     "required": true
    },
    {
     "name": "expires_at",
     "type": "timestamp",
     "required": true
    },
    {
     "name": "status",
     "type": "enum",
     "required": true,
     "enum": [
      "open",
      "resolved",
      "expired"
     ]
    },
    {
     "name": "resolved_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "recipients",
     "type": "text",
     "required": false
    }
   ]
  },
  "notification_state": {
   "description": "Per user and notification: seen, snoozed or dismissed. One row per user and notification (upsert).",
   "key": [
    "user_id",
    "notification_id"
   ],
   "columns": [
    {
     "name": "user_id",
     "type": "text",
     "required": true
    },
    {
     "name": "notification_id",
     "type": "text",
     "required": true
    },
    {
     "name": "state",
     "type": "enum",
     "required": true,
     "enum": [
      "seen",
      "snoozed",
      "dismissed"
     ]
    },
    {
     "name": "snooze_until",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "updated_at",
     "type": "timestamp",
     "required": true
    }
   ]
  },
  "notification_prefs": {
   "description": "Per user notification preferences. One row per user and key (upsert).",
   "key": [
    "user_id",
    "key"
   ],
   "columns": [
    {
     "name": "user_id",
     "type": "text",
     "required": true
    },
    {
     "name": "key",
     "type": "text",
     "required": true
    },
    {
     "name": "value",
     "type": "text",
     "required": false
    },
    {
     "name": "updated_at",
     "type": "timestamp",
     "required": true
    }
   ]
  },
  "actions": {
   "description": "Improvement actions (docs/actions-design.md). Created by people or drafted by the server rules; one dedupe_key per cause keeps one open action for it.",
   "key": [
    "action_id"
   ],
   "columns": [
    {
     "name": "action_id",
     "type": "text",
     "required": true
    },
    {
     "name": "title",
     "type": "text",
     "required": true
    },
    {
     "name": "detail",
     "type": "text",
     "required": false
    },
    {
     "name": "status",
     "type": "enum",
     "required": true,
     "enum": [
      "Draft",
      "Open",
      "In progress",
      "Closed",
      "Cancelled"
     ]
    },
    {
     "name": "priority",
     "type": "enum",
     "required": true,
     "enum": [
      "High",
      "Medium",
      "Low"
     ]
    },
    {
     "name": "source",
     "type": "enum",
     "required": true,
     "enum": [
      "auto_repeat",
      "auto_chronic",
      "auto_long_stop",
      "auto_planned_overrun",
      "notification",
      "report",
      "pareto",
      "event",
      "manual"
     ]
    },
    {
     "name": "source_ref",
     "type": "text",
     "required": false
    },
    {
     "name": "scope_kind",
     "type": "enum",
     "required": true,
     "enum": [
      "equipment",
      "area",
      "line",
      "plant"
     ]
    },
    {
     "name": "area_id",
     "type": "text",
     "required": false
    },
    {
     "name": "line_id",
     "type": "text",
     "required": false
    },
    {
     "name": "equipment_id",
     "type": "text",
     "required": false
    },
    {
     "name": "reason_key",
     "type": "text",
     "required": false
    },
    {
     "name": "owner_kind",
     "type": "enum",
     "required": true,
     "enum": [
      "contractor",
      "internal"
     ]
    },
    {
     "name": "owner",
     "type": "text",
     "required": false
    },
    {
     "name": "assignee",
     "type": "text",
     "required": false
    },
    {
     "name": "due_date",
     "type": "date",
     "required": false
    },
    {
     "name": "needs_stop",
     "type": "bool",
     "required": false
    },
    {
     "name": "root_cause",
     "type": "enum",
     "required": false,
     "enum": [
      "",
      "PRO",
      "MEC",
      "ELE",
      "AUT",
      "OPR",
      "EXT"
     ]
    },
    {
     "name": "required_action",
     "type": "text",
     "required": false
    },
    {
     "name": "created_by",
     "type": "text",
     "required": true
    },
    {
     "name": "created_at",
     "type": "timestamp",
     "required": true
    },
    {
     "name": "updated_at",
     "type": "timestamp",
     "required": true
    },
    {
     "name": "updated_by",
     "type": "text",
     "required": false
    },
    {
     "name": "closed_by",
     "type": "text",
     "required": false
    },
    {
     "name": "closed_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "closure_note",
     "type": "text",
     "required": false
    },
    {
     "name": "effectiveness",
     "type": "enum",
     "required": false,
     "enum": [
      "",
      "Watching",
      "Effective",
      "Not effective"
     ]
    },
    {
     "name": "effectiveness_checked_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "evidence",
     "type": "text",
     "required": false
    },
    {
     "name": "dedupe_key",
     "type": "text",
     "required": false
    },
    {
     "name": "template_id",
     "type": "text",
     "required": false
    }
   ]
  },
  "action_log": {
   "description": "History of every action: status changes, comments, edits and added evidence. Append-only.",
   "key": [
    "log_id"
   ],
   "columns": [
    {
     "name": "log_id",
     "type": "text",
     "required": true
    },
    {
     "name": "action_id",
     "type": "text",
     "required": true
    },
    {
     "name": "at",
     "type": "timestamp",
     "required": true
    },
    {
     "name": "by",
     "type": "text",
     "required": true
    },
    {
     "name": "kind",
     "type": "enum",
     "required": true,
     "enum": [
      "status",
      "comment",
      "edit",
      "evidence",
      "task_create",
      "task_status",
      "task_edit",
      "task_note"
     ]
    },
    {
     "name": "from_status",
     "type": "text",
     "required": false
    },
    {
     "name": "to_status",
     "type": "text",
     "required": false
    },
    {
     "name": "text",
     "type": "text",
     "required": false
    },
    {
     "name": "task_id",
     "type": "text",
     "required": false
    }
   ]
  },
  "action_tasks": {
   "description": "1.7.0: the tasks (the work) of an action. Never deleted: a task that is not needed gets the status Not needed.",
   "key": [
    "task_id"
   ],
   "columns": [
    {
     "name": "task_id",
     "type": "text",
     "required": true
    },
    {
     "name": "action_id",
     "type": "text",
     "required": true
    },
    {
     "name": "seq",
     "type": "int",
     "required": true
    },
    {
     "name": "title",
     "type": "text",
     "required": true
    },
    {
     "name": "owner_kind",
     "type": "enum",
     "required": true,
     "enum": [
      "contractor",
      "internal"
     ]
    },
    {
     "name": "owner",
     "type": "text",
     "required": false
    },
    {
     "name": "assignee",
     "type": "text",
     "required": false
    },
    {
     "name": "due_date",
     "type": "date",
     "required": false
    },
    {
     "name": "status",
     "type": "enum",
     "required": true,
     "enum": [
      "Open",
      "Contractor informed",
      "Waiting stoppage",
      "In progress",
      "Done",
      "Not needed"
     ]
    },
    {
     "name": "needs_stop",
     "type": "bool",
     "required": false
    },
    {
     "name": "est_stop_h",
     "type": "float",
     "required": false
    },
    {
     "name": "notes",
     "type": "text",
     "required": false
    },
    {
     "name": "template_step",
     "type": "text",
     "required": false
    },
    {
     "name": "created_at",
     "type": "timestamp",
     "required": true
    },
    {
     "name": "created_by",
     "type": "text",
     "required": true
    },
    {
     "name": "updated_at",
     "type": "timestamp",
     "required": true
    },
    {
     "name": "updated_by",
     "type": "text",
     "required": false
    },
    {
     "name": "done_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "done_by",
     "type": "text",
     "required": false
    },
    {
     "name": "done_note",
     "type": "text",
     "required": false
    }
   ]
  },
  "contractors": {
   "description": "External contractors and internal teams that own actions, with the areas each contractor is responsible for.",
   "key": [
    "contractor_id"
   ],
   "columns": [
    {
     "name": "contractor_id",
     "type": "text",
     "required": true
    },
    {
     "name": "name",
     "type": "text",
     "required": true
    },
    {
     "name": "areas",
     "type": "text",
     "required": false
    },
    {
     "name": "kind",
     "type": "enum",
     "required": true,
     "enum": [
      "contractor",
      "internal"
     ]
    },
    {
     "name": "active",
     "type": "bool",
     "required": true
    },
    {
     "name": "sort_order",
     "type": "int",
     "required": true
    },
    {
     "name": "default_assignee",
     "type": "text",
     "required": false
    }
   ]
  },
  "area_targets": {
   "description": "Per area and year: availability target and planned-stop allowance, split into months.",
   "key": [
    "area_id",
    "year"
   ],
   "columns": [
    {
     "name": "area_id",
     "type": "text",
     "required": true
    },
    {
     "name": "year",
     "type": "int",
     "required": true
    },
    {
     "name": "availability_target_pct",
     "type": "float",
     "required": false
    },
    {
     "name": "planned_allowance_h_year",
     "type": "float",
     "required": true
    },
    {
     "name": "monthly_split",
     "type": "text",
     "required": true
    },
    {
     "name": "overhaul_months",
     "type": "text",
     "required": false
    },
    {
     "name": "updated_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "updated_by",
     "type": "text",
     "required": false
    },
    {
     "name": "reliability_target_pct",
     "type": "float",
     "required": false
    },
    {
     "name": "utilization_target_pct",
     "type": "float",
     "required": false
    }
   ]
  },
  "task_templates": {
   "description": "1.7.0: ready-made task lists picked when an action is created; an auto draft gets the active template that applies to its rule.",
   "key": [
    "template_id"
   ],
   "columns": [
    {
     "name": "template_id",
     "type": "text",
     "required": true
    },
    {
     "name": "name",
     "type": "text",
     "required": true
    },
    {
     "name": "applies_to",
     "type": "text",
     "required": false
    },
    {
     "name": "active",
     "type": "bool",
     "required": true
    },
    {
     "name": "sort_order",
     "type": "int",
     "required": true
    },
    {
     "name": "updated_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "updated_by",
     "type": "text",
     "required": false
    }
   ]
  },
  "task_template_steps": {
   "description": "1.7.0: the steps (tasks) of each task template, in order. Saving a template replaces all its steps.",
   "key": [
    "template_id",
    "seq"
   ],
   "columns": [
    {
     "name": "template_id",
     "type": "text",
     "required": true
    },
    {
     "name": "seq",
     "type": "int",
     "required": true
    },
    {
     "name": "title",
     "type": "text",
     "required": true
    },
    {
     "name": "default_owner",
     "type": "text",
     "required": true
    },
    {
     "name": "due_offset_days",
     "type": "int",
     "required": true
    },
    {
     "name": "needs_stop",
     "type": "bool",
     "required": false
    },
    {
     "name": "est_stop_h",
     "type": "float",
     "required": false
    }
   ]
  },
  "user_activity": {
   "description": "Who used the app and when (1.6.0): one row per user, upserted by the server at most once every 3 minutes per user. Shown to Admins in Settings > Active users.",
   "key": [
    "user_id"
   ],
   "columns": [
    {
     "name": "user_id",
     "type": "text",
     "required": true
    },
    {
     "name": "last_seen_at",
     "type": "timestamp",
     "required": true
    },
    {
     "name": "last_page",
     "type": "text",
     "required": false
    },
    {
     "name": "device",
     "type": "enum",
     "required": false,
     "enum": [
      "phone",
      "desktop"
     ]
    },
    {
     "name": "updated_at",
     "type": "timestamp",
     "required": true
    }
   ]
  },
  "shifts": {
   "description": "Plant shifts (v7, Stage 1). Times are plant-local HH:MM; a shift may cross midnight.",
   "key": [
    "shift_id"
   ],
   "columns": [
    {
     "name": "shift_id",
     "type": "text",
     "required": true
    },
    {
     "name": "name",
     "type": "text",
     "required": true
    },
    {
     "name": "start_time",
     "type": "text",
     "required": true
    },
    {
     "name": "end_time",
     "type": "text",
     "required": true
    },
    {
     "name": "sort_order",
     "type": "int",
     "required": true
    },
    {
     "name": "active",
     "type": "bool",
     "required": true
    },
    {
     "name": "notes",
     "type": "text",
     "required": false
    }
   ]
  },
  "shift_reports": {
   "description": "One shift report per date, shift and area (v7, Stage 1). Moves Draft -> Submitted -> Production approved -> Validated -> Posted; can be Returned at each review step.",
   "key": [
    "report_id"
   ],
   "columns": [
    {
     "name": "report_id",
     "type": "text",
     "required": true
    },
    {
     "name": "report_date",
     "type": "date",
     "required": true
    },
    {
     "name": "shift_id",
     "type": "text",
     "required": true
    },
    {
     "name": "area_id",
     "type": "text",
     "required": true
    },
    {
     "name": "line_id",
     "type": "text",
     "required": true
    },
    {
     "name": "status",
     "type": "enum",
     "required": true,
     "enum": [
      "draft",
      "submitted",
      "returned",
      "prod_approved",
      "validated",
      "posted"
     ]
    },
    {
     "name": "source",
     "type": "enum",
     "required": true,
     "enum": [
      "app",
      "excel_import",
      "history"
     ]
    },
    {
     "name": "import_batch_id",
     "type": "text",
     "required": false
    },
    {
     "name": "entered_by",
     "type": "text",
     "required": false
    },
    {
     "name": "entered_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "submitted_by",
     "type": "text",
     "required": false
    },
    {
     "name": "submitted_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "prod_reviewed_by",
     "type": "text",
     "required": false
    },
    {
     "name": "prod_reviewed_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "rel_validated_by",
     "type": "text",
     "required": false
    },
    {
     "name": "rel_validated_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "posted_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "returned_by",
     "type": "text",
     "required": false
    },
    {
     "name": "returned_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "return_stage",
     "type": "enum",
     "required": false,
     "enum": [
      "production",
      "reliability"
     ]
    },
    {
     "name": "return_comment",
     "type": "text",
     "required": false
    },
    {
     "name": "notes",
     "type": "text",
     "required": false
    },
    {
     "name": "updated_by",
     "type": "text",
     "required": false
    },
    {
     "name": "updated_at",
     "type": "timestamp",
     "required": false
    }
   ]
  },
  "shift_stoppages": {
   "description": "Stoppages entered in a shift report (v7, Stage 1). Same fields as events. A stop that lasts beyond the shift stays open and any later shift of the area enters its restart time; it becomes an event when closed and validated.",
   "key": [
    "stop_id"
   ],
   "columns": [
    {
     "name": "stop_id",
     "type": "text",
     "required": true
    },
    {
     "name": "report_id",
     "type": "text",
     "required": true
    },
    {
     "name": "area_id",
     "type": "text",
     "required": true
    },
    {
     "name": "line_id",
     "type": "text",
     "required": true
    },
    {
     "name": "code_raw",
     "type": "text",
     "required": false
    },
    {
     "name": "equipment_id",
     "type": "text",
     "required": false
    },
    {
     "name": "stop_ts",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "start_ts",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "duration_s",
     "type": "int",
     "required": false
    },
    {
     "name": "freq",
     "type": "int",
     "required": false
    },
    {
     "name": "classification",
     "type": "text",
     "required": false
    },
    {
     "name": "criticality",
     "type": "enum",
     "required": false,
     "enum": [
      "INC",
      "NO_INC"
     ]
    },
    {
     "name": "is_failure",
     "type": "bool",
     "required": false
    },
    {
     "name": "reason_raw",
     "type": "text",
     "required": false
    },
    {
     "name": "reason_id",
     "type": "text",
     "required": false
    },
    {
     "name": "description",
     "type": "text",
     "required": false
    },
    {
     "name": "flags",
     "type": "text",
     "required": false
    },
    {
     "name": "stop_state",
     "type": "enum",
     "required": true,
     "enum": [
      "open",
      "closed"
     ]
    },
    {
     "name": "closed_report_id",
     "type": "text",
     "required": false
    },
    {
     "name": "closed_by",
     "type": "text",
     "required": false
    },
    {
     "name": "closed_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "row_state",
     "type": "enum",
     "required": true,
     "enum": [
      "active",
      "deleted"
     ]
    },
    {
     "name": "posted_event_id",
     "type": "text",
     "required": false
    },
    {
     "name": "created_by",
     "type": "text",
     "required": false
    },
    {
     "name": "created_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "updated_by",
     "type": "text",
     "required": false
    },
    {
     "name": "updated_at",
     "type": "timestamp",
     "required": false
    }
   ]
  },
  "shift_stoppage_edits": {
   "description": "Every change to a shift stoppage after it was submitted: who, which step, old and new value, why (v7).",
   "key": [
    "edit_id"
   ],
   "columns": [
    {
     "name": "edit_id",
     "type": "text",
     "required": true
    },
    {
     "name": "stop_id",
     "type": "text",
     "required": true
    },
    {
     "name": "report_id",
     "type": "text",
     "required": true
    },
    {
     "name": "stage",
     "type": "enum",
     "required": true,
     "enum": [
      "entry",
      "production",
      "reliability"
     ]
    },
    {
     "name": "field",
     "type": "text",
     "required": true
    },
    {
     "name": "old_value",
     "type": "text",
     "required": false
    },
    {
     "name": "new_value",
     "type": "text",
     "required": false
    },
    {
     "name": "comment",
     "type": "text",
     "required": false
    },
    {
     "name": "edited_by",
     "type": "text",
     "required": true
    },
    {
     "name": "edited_at",
     "type": "timestamp",
     "required": false
    }
   ]
  },
  "workflow_log": {
   "description": "Status changes of shift reports (v7).",
   "key": [
    "log_id"
   ],
   "columns": [
    {
     "name": "log_id",
     "type": "text",
     "required": true
    },
    {
     "name": "report_id",
     "type": "text",
     "required": true
    },
    {
     "name": "action",
     "type": "enum",
     "required": true,
     "enum": [
      "create",
      "submit",
      "approve",
      "return",
      "validate",
      "post",
      "reopen"
     ]
    },
    {
     "name": "from_status",
     "type": "text",
     "required": false
    },
    {
     "name": "to_status",
     "type": "text",
     "required": false
    },
    {
     "name": "stage",
     "type": "enum",
     "required": false,
     "enum": [
      "entry",
      "production",
      "reliability"
     ]
    },
    {
     "name": "by_user",
     "type": "text",
     "required": true
    },
    {
     "name": "at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "comment",
     "type": "text",
     "required": false
    }
   ]
  },
  "responsibilities": {
   "description": "Who does what, where (v7). One row per user, duty and scope; a user may hold several.",
   "key": [
    "resp_id"
   ],
   "columns": [
    {
     "name": "resp_id",
     "type": "text",
     "required": true
    },
    {
     "name": "user_id",
     "type": "text",
     "required": true
    },
    {
     "name": "duty",
     "type": "enum",
     "required": true,
     "enum": [
      "shift_entry",
      "production_review",
      "reliability_validation",
      "production_data",
      "quality_validation",
      "month_review",
      "month_signoff",
      "targets",
      "master_data",
      "daily_meeting"
     ]
    },
    {
     "name": "section",
     "type": "enum",
     "required": false,
     "enum": [
      "downtime",
      "production",
      "quality",
      "plant"
     ]
    },
    {
     "name": "scope_type",
     "type": "enum",
     "required": true,
     "enum": [
      "plant",
      "line",
      "area"
     ]
    },
    {
     "name": "scope_id",
     "type": "text",
     "required": false
    },
    {
     "name": "is_backup",
     "type": "bool",
     "required": true
    },
    {
     "name": "valid_from",
     "type": "date",
     "required": false
    },
    {
     "name": "valid_to",
     "type": "date",
     "required": false
    },
    {
     "name": "active",
     "type": "bool",
     "required": true
    },
    {
     "name": "created_by",
     "type": "text",
     "required": false
    },
    {
     "name": "created_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "updated_by",
     "type": "text",
     "required": false
    },
    {
     "name": "updated_at",
     "type": "timestamp",
     "required": false
    }
   ]
  },
  "kpi_definitions": {
   "description": "One agreed definition per KPI (v7, Stage 0). Seeded as draft from the NRS workbook; approved by the owner.",
   "key": [
    "kpi_id"
   ],
   "columns": [
    {
     "name": "kpi_id",
     "type": "text",
     "required": true
    },
    {
     "name": "name",
     "type": "text",
     "required": true
    },
    {
     "name": "category",
     "type": "enum",
     "required": true,
     "enum": [
      "reliability",
      "production",
      "energy",
      "fuel",
      "water",
      "stock",
      "materials",
      "quality",
      "data"
     ]
    },
    {
     "name": "unit",
     "type": "text",
     "required": false
    },
    {
     "name": "formula",
     "type": "text",
     "required": true
    },
    {
     "name": "aggregation",
     "type": "enum",
     "required": true,
     "enum": [
      "ratio_of_sums",
      "sum",
      "average",
      "std_dev",
      "share_in_spec",
      "last"
     ]
    },
    {
     "name": "better",
     "type": "enum",
     "required": true,
     "enum": [
      "higher",
      "lower",
      "none"
     ]
    },
    {
     "name": "decimals",
     "type": "int",
     "required": true
    },
    {
     "name": "applies_to",
     "type": "text",
     "required": false
    },
    {
     "name": "nrs_formula",
     "type": "text",
     "required": false
    },
    {
     "name": "app_formula",
     "type": "text",
     "required": false
    },
    {
     "name": "decision",
     "type": "text",
     "required": false
    },
    {
     "name": "status",
     "type": "enum",
     "required": true,
     "enum": [
      "draft",
      "approved"
     ]
    },
    {
     "name": "approved_by",
     "type": "text",
     "required": false
    },
    {
     "name": "approved_at",
     "type": "timestamp",
     "required": false
    }
   ]
  },
  "kpi_targets": {
   "description": "Targets by scope, KPI and month (v7). Replaces the 9 NRS target sheets and the hard-coded KPI targets; month 0 = whole year.",
   "key": [
    "scope_type",
    "scope_id",
    "kpi_id",
    "year",
    "month"
   ],
   "columns": [
    {
     "name": "scope_type",
     "type": "enum",
     "required": true,
     "enum": [
      "plant",
      "line",
      "area"
     ]
    },
    {
     "name": "scope_id",
     "type": "text",
     "required": false
    },
    {
     "name": "kpi_id",
     "type": "text",
     "required": true
    },
    {
     "name": "year",
     "type": "int",
     "required": true
    },
    {
     "name": "month",
     "type": "int",
     "required": true
    },
    {
     "name": "target_value",
     "type": "float",
     "required": false
    },
    {
     "name": "lower_limit",
     "type": "float",
     "required": false
    },
    {
     "name": "upper_limit",
     "type": "float",
     "required": false
    },
    {
     "name": "source",
     "type": "text",
     "required": false
    },
    {
     "name": "updated_by",
     "type": "text",
     "required": false
    },
    {
     "name": "updated_at",
     "type": "timestamp",
     "required": false
    }
   ]
  },
  "production_metrics": {
   "description": "What is measured in each area each day (v7, Stage 2): production, running hours, power, fuel, water, stocks.",
   "key": [
    "metric_id"
   ],
   "columns": [
    {
     "name": "metric_id",
     "type": "text",
     "required": true
    },
    {
     "name": "area_id",
     "type": "text",
     "required": true
    },
    {
     "name": "name",
     "type": "text",
     "required": true
    },
    {
     "name": "unit",
     "type": "text",
     "required": true
    },
    {
     "name": "category",
     "type": "enum",
     "required": true,
     "enum": [
      "production",
      "running",
      "power",
      "fuel",
      "water",
      "stock",
      "materials",
      "other"
     ]
    },
    {
     "name": "dcs_tag",
     "type": "text",
     "required": false
    },
    {
     "name": "entry_mode",
     "type": "enum",
     "required": true,
     "enum": [
      "dcs",
      "manual",
      "calculated"
     ]
    },
    {
     "name": "required",
     "type": "bool",
     "required": true
    },
    {
     "name": "min_value",
     "type": "float",
     "required": false
    },
    {
     "name": "max_value",
     "type": "float",
     "required": false
    },
    {
     "name": "sort_order",
     "type": "int",
     "required": true
    },
    {
     "name": "active",
     "type": "bool",
     "required": true
    },
    {
     "name": "notes",
     "type": "text",
     "required": false
    }
   ]
  },
  "production_values": {
   "description": "Daily (or per shift) values per area and metric (v7, Stage 2). Raw value from the DCS or the shift leader, plus a recorded correction.",
   "key": [
    "value_id"
   ],
   "columns": [
    {
     "name": "value_id",
     "type": "text",
     "required": true
    },
    {
     "name": "prod_date",
     "type": "date",
     "required": true
    },
    {
     "name": "shift_id",
     "type": "text",
     "required": false
    },
    {
     "name": "area_id",
     "type": "text",
     "required": true
    },
    {
     "name": "metric_id",
     "type": "text",
     "required": true
    },
    {
     "name": "raw_value",
     "type": "float",
     "required": false
    },
    {
     "name": "correction",
     "type": "float",
     "required": false
    },
    {
     "name": "final_value",
     "type": "float",
     "required": false
    },
    {
     "name": "source",
     "type": "enum",
     "required": true,
     "enum": [
      "dcs",
      "manual",
      "calculated"
     ]
    },
    {
     "name": "batch_id",
     "type": "text",
     "required": false
    },
    {
     "name": "report_id",
     "type": "text",
     "required": false
    },
    {
     "name": "status",
     "type": "enum",
     "required": true,
     "enum": [
      "entered",
      "approved",
      "validated"
     ]
    },
    {
     "name": "entered_by",
     "type": "text",
     "required": false
    },
    {
     "name": "entered_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "updated_by",
     "type": "text",
     "required": false
    },
    {
     "name": "updated_at",
     "type": "timestamp",
     "required": false
    }
   ]
  },
  "production_corrections": {
   "description": "Requested and approved corrections to production values, with the reason (v7, Stage 2). Replaces the NRS *_Corr tables.",
   "key": [
    "corr_id"
   ],
   "columns": [
    {
     "name": "corr_id",
     "type": "text",
     "required": true
    },
    {
     "name": "prod_date",
     "type": "date",
     "required": true
    },
    {
     "name": "area_id",
     "type": "text",
     "required": true
    },
    {
     "name": "metric_id",
     "type": "text",
     "required": true
    },
    {
     "name": "old_value",
     "type": "float",
     "required": false
    },
    {
     "name": "new_value",
     "type": "float",
     "required": false
    },
    {
     "name": "reason",
     "type": "text",
     "required": true
    },
    {
     "name": "requested_by",
     "type": "text",
     "required": true
    },
    {
     "name": "requested_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "approved_by",
     "type": "text",
     "required": false
    },
    {
     "name": "approved_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "status",
     "type": "enum",
     "required": true,
     "enum": [
      "requested",
      "approved",
      "rejected"
     ]
    }
   ]
  },
  "dcs_import_batches": {
   "description": "Each imported DCS automated report or shift workbook (v7).",
   "key": [
    "batch_id"
   ],
   "columns": [
    {
     "name": "batch_id",
     "type": "text",
     "required": true
    },
    {
     "name": "file_name",
     "type": "text",
     "required": true
    },
    {
     "name": "file_hash",
     "type": "text",
     "required": true
    },
    {
     "name": "report_type",
     "type": "enum",
     "required": true,
     "enum": [
      "dcs_plg1",
      "dcs_plg2",
      "shift_workbook",
      "nrs_history"
     ]
    },
    {
     "name": "date_from",
     "type": "date",
     "required": false
    },
    {
     "name": "date_to",
     "type": "date",
     "required": false
    },
    {
     "name": "rows",
     "type": "int",
     "required": false
    },
    {
     "name": "uploaded_by",
     "type": "text",
     "required": true
    },
    {
     "name": "uploaded_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "status",
     "type": "enum",
     "required": true,
     "enum": [
      "ok",
      "partial",
      "failed"
     ]
    },
    {
     "name": "notes",
     "type": "text",
     "required": false
    }
   ]
  },
  "quality_parameters": {
   "description": "What the laboratory measures, where, and its limits (v7). One row per sample point and parameter, e.g. RM.1 raw meal LSF.",
   "key": [
    "param_id"
   ],
   "columns": [
    {
     "name": "param_id",
     "type": "text",
     "required": true
    },
    {
     "name": "area_id",
     "type": "text",
     "required": true
    },
    {
     "name": "material",
     "type": "enum",
     "required": true,
     "enum": [
      "raw_meal",
      "kiln_feed",
      "hot_meal",
      "clinker",
      "coal",
      "petcoke",
      "cement",
      "other"
     ]
    },
    {
     "name": "name",
     "type": "text",
     "required": true
    },
    {
     "name": "unit",
     "type": "text",
     "required": true
    },
    {
     "name": "spec_min",
     "type": "float",
     "required": false
    },
    {
     "name": "spec_max",
     "type": "float",
     "required": false
    },
    {
     "name": "target",
     "type": "float",
     "required": false
    },
    {
     "name": "valid_min",
     "type": "float",
     "required": false
    },
    {
     "name": "valid_max",
     "type": "float",
     "required": false
    },
    {
     "name": "samples_per_day",
     "type": "int",
     "required": false
    },
    {
     "name": "qcx_column",
     "type": "text",
     "required": false
    },
    {
     "name": "sort_order",
     "type": "int",
     "required": true
    },
    {
     "name": "active",
     "type": "bool",
     "required": true
    },
    {
     "name": "notes",
     "type": "text",
     "required": false
    },
    {
     "name": "updated_by",
     "type": "text",
     "required": false
    },
    {
     "name": "updated_at",
     "type": "timestamp",
     "required": false
    }
   ]
  },
  "quality_results": {
   "description": "Laboratory results (v7). One row per sample, or one daily average when only the QCX daily export is available.",
   "key": [
    "result_id"
   ],
   "columns": [
    {
     "name": "result_id",
     "type": "text",
     "required": true
    },
    {
     "name": "sample_ts",
     "type": "timestamp",
     "required": true
    },
    {
     "name": "prod_date",
     "type": "date",
     "required": true
    },
    {
     "name": "shift_id",
     "type": "text",
     "required": false
    },
    {
     "name": "param_id",
     "type": "text",
     "required": true
    },
    {
     "name": "value",
     "type": "float",
     "required": false
    },
    {
     "name": "basis",
     "type": "enum",
     "required": true,
     "enum": [
      "sample",
      "daily_avg"
     ]
    },
    {
     "name": "source",
     "type": "enum",
     "required": true,
     "enum": [
      "qcx",
      "manual",
      "analyser"
     ]
    },
    {
     "name": "batch_id",
     "type": "text",
     "required": false
    },
    {
     "name": "status",
     "type": "enum",
     "required": true,
     "enum": [
      "entered",
      "validated",
      "rejected"
     ]
    },
    {
     "name": "comment",
     "type": "text",
     "required": false
    },
    {
     "name": "entered_by",
     "type": "text",
     "required": false
    },
    {
     "name": "entered_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "validated_by",
     "type": "text",
     "required": false
    },
    {
     "name": "validated_at",
     "type": "timestamp",
     "required": false
    }
   ]
  },
  "check_rules": {
   "description": "The data checks the app runs on every section (v7). Thresholds are editable; a rule never changes a value, it raises a check for review.",
   "key": [
    "rule_id"
   ],
   "columns": [
    {
     "name": "rule_id",
     "type": "text",
     "required": true
    },
    {
     "name": "section",
     "type": "enum",
     "required": true,
     "enum": [
      "downtime",
      "production",
      "energy",
      "fuel",
      "water",
      "stock",
      "materials",
      "quality",
      "cross"
     ]
    },
    {
     "name": "check_type",
     "type": "enum",
     "required": true,
     "enum": [
      "missing",
      "range",
      "spec",
      "change",
      "balance",
      "reconcile",
      "count",
      "duplicate",
      "order"
     ]
    },
    {
     "name": "name",
     "type": "text",
     "required": true
    },
    {
     "name": "description",
     "type": "text",
     "required": true
    },
    {
     "name": "applies_to",
     "type": "text",
     "required": false
    },
    {
     "name": "threshold",
     "type": "float",
     "required": false
    },
    {
     "name": "threshold_unit",
     "type": "text",
     "required": false
    },
    {
     "name": "severity",
     "type": "enum",
     "required": true,
     "enum": [
      "block",
      "warn",
      "info"
     ]
    },
    {
     "name": "owner_duty",
     "type": "text",
     "required": false
    },
    {
     "name": "active",
     "type": "bool",
     "required": true
    },
    {
     "name": "updated_by",
     "type": "text",
     "required": false
    },
    {
     "name": "updated_at",
     "type": "timestamp",
     "required": false
    }
   ]
  },
  "data_checks": {
   "description": "Every check raised by check_rules and what was done about it (v7).",
   "key": [
    "check_id"
   ],
   "columns": [
    {
     "name": "check_id",
     "type": "text",
     "required": true
    },
    {
     "name": "rule_id",
     "type": "text",
     "required": true
    },
    {
     "name": "section",
     "type": "text",
     "required": true
    },
    {
     "name": "prod_date",
     "type": "date",
     "required": true
    },
    {
     "name": "area_id",
     "type": "text",
     "required": false
    },
    {
     "name": "subject_table",
     "type": "text",
     "required": true
    },
    {
     "name": "subject_id",
     "type": "text",
     "required": true
    },
    {
     "name": "value",
     "type": "text",
     "required": false
    },
    {
     "name": "message",
     "type": "text",
     "required": true
    },
    {
     "name": "state",
     "type": "enum",
     "required": true,
     "enum": [
      "open",
      "accepted",
      "corrected",
      "dismissed"
     ]
    },
    {
     "name": "resolution",
     "type": "text",
     "required": false
    },
    {
     "name": "raised_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "resolved_by",
     "type": "text",
     "required": false
    },
    {
     "name": "resolved_at",
     "type": "timestamp",
     "required": false
    }
   ]
  },
  "month_closings": {
   "description": "Month-end closing of each section (v7): the section engineer reviews, then the section manager signs off; a signed-off month is locked and any later change needs a reopen with a reason.",
   "key": [
    "section",
    "year",
    "month"
   ],
   "columns": [
    {
     "name": "section",
     "type": "enum",
     "required": true,
     "enum": [
      "downtime",
      "production",
      "quality",
      "plant"
     ]
    },
    {
     "name": "year",
     "type": "int",
     "required": true
    },
    {
     "name": "month",
     "type": "int",
     "required": true
    },
    {
     "name": "status",
     "type": "enum",
     "required": true,
     "enum": [
      "open",
      "reviewed",
      "signed_off",
      "reopened"
     ]
    },
    {
     "name": "open_checks",
     "type": "int",
     "required": false
    },
    {
     "name": "reviewed_by",
     "type": "text",
     "required": false
    },
    {
     "name": "reviewed_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "review_comment",
     "type": "text",
     "required": false
    },
    {
     "name": "signed_off_by",
     "type": "text",
     "required": false
    },
    {
     "name": "signed_off_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "signoff_comment",
     "type": "text",
     "required": false
    },
    {
     "name": "reopened_by",
     "type": "text",
     "required": false
    },
    {
     "name": "reopened_at",
     "type": "timestamp",
     "required": false
    },
    {
     "name": "reopen_reason",
     "type": "text",
     "required": false
    },
    {
     "name": "updated_at",
     "type": "timestamp",
     "required": false
    }
   ]
  }
 },
 "seeds": {
  "settings": [
   {
    "key": "availability_basis",
    "value": "B",
    "description": "A calendar; B calendar minus planned (headline); C minus planned and circumstantial"
   },
   {
    "key": "scheduled_hours_per_day",
    "value": "24",
    "description": "Scheduled hours per area per day"
   },
   {
    "key": "scheduled_days_per_week",
    "value": "7",
    "description": "Scheduled days per week"
   },
   {
    "key": "repeat_min_events",
    "value": "2",
    "description": "Failure events needed to flag a repeated failure"
   },
   {
    "key": "repeat_window_days",
    "value": "30",
    "description": "Window for repeated failures, in days"
   },
   {
    "key": "duration_short_max_min",
    "value": "30",
    "description": "Stops up to this many minutes are Short"
   },
   {
    "key": "duration_long_min_min",
    "value": "120",
    "description": "Stops from this many minutes are Long"
   },
   {
    "key": "availability_target_pct",
    "value": "",
    "description": "Availability target, percent; blank = none"
   },
   {
    "key": "default_comparison",
    "value": "previous_period",
    "description": "previous_period | same_period_last_year"
   },
   {
    "key": "lockout_attempts",
    "value": "5",
    "description": "Failed sign-ins before a temporary lock"
   },
   {
    "key": "lockout_minutes",
    "value": "30",
    "description": "Longest wait between attempts after too many wrong passwords (1, 2, 4, 8, 16 minutes, then this)"
   },
   {
    "key": "session_hours",
    "value": "12",
    "description": "Session length without 'Keep me signed in'"
   },
   {
    "key": "session_hours_keep",
    "value": "336",
    "description": "Session length with 'Keep me signed in' (336 h = 14 days)"
   },
   {
    "key": "min_password_length",
    "value": "10",
    "description": "Minimum password length"
   },
   {
    "key": "notif_long_stop_hours",
    "value": "8",
    "description": "A failure event longer than this many hours raises an alert"
   },
   {
    "key": "notif_spike_pct",
    "value": "30",
    "description": "Failures in the last 30 days of data up by more than this percent on the 30 days before (and at least 5 now) raise an alert"
   },
   {
    "key": "notif_upload_gap_days",
    "value": "35",
    "description": "Latest stored event older than this many days raises 'No upload since'"
   },
   {
    "key": "notif_repeat_alert",
    "value": "true",
    "description": "true | false. A new repeated-failure group raises an alert"
   },
   {
    "key": "notif_retention_days",
    "value": "30",
    "description": "Alerts and updates expire after this many days"
   },
   {
    "key": "app_url",
    "value": "",
    "description": "Web address of the app, used for the link in digest emails; blank = no link"
   },
   {
    "key": "target_mtbf_h",
    "value": "",
    "description": "MTBF target, hours (above 0, up to 100000); blank = no target"
   },
   {
    "key": "target_mttr_h",
    "value": "",
    "description": "MTTR target, hours (above 0, up to 100000); blank = no target"
   },
   {
    "key": "reliability_target_pct",
    "value": "95",
    "description": "Reliability factor (RF) target, percent; blank = none"
   },
   {
    "key": "utilization_target_pct",
    "value": "",
    "description": "Utilization factor (UF) target, percent; blank = none"
   },
   {
    "key": "system_email",
    "value": "",
    "description": "Address the app's emails are sent from: a 'Send mail as' alias of the Google account that deploys the script; blank = that account"
   },
   {
    "key": "system_email_name",
    "value": "ACC Downtime Analysis",
    "description": "Sender name shown on the app's emails"
   },
   {
    "key": "actions_closers",
    "value": "",
    "description": "Comma-separated user ids who may close or cancel actions (Admins always can)"
   },
   {
    "key": "actions_repeat_n",
    "value": "3",
    "description": "Repeated-failure draft: this many failure events of the same equipment and reason ..."
   },
   {
    "key": "actions_repeat_days",
    "value": "30",
    "description": "... within this many days"
   },
   {
    "key": "actions_chronic_top",
    "value": "10",
    "description": "Chronic-equipment draft: in the top this many equipment by failure hours ..."
   },
   {
    "key": "actions_chronic_months",
    "value": "3",
    "description": "... for this many complete months in a row"
   },
   {
    "key": "actions_effect_days",
    "value": "60",
    "description": "Effectiveness check: days watched after closing (compared with the same number of days before)"
   },
   {
    "key": "actions_auto_draft",
    "value": "true",
    "description": "true | false. The server rules create Draft actions"
   },
   {
    "key": "shift_submit_deadline_h",
    "value": "2",
    "description": "Hours after the shift ends for the shift leader to submit"
   },
   {
    "key": "prod_review_deadline_h",
    "value": "12",
    "description": "Hours after submission for the production manager to approve or return"
   },
   {
    "key": "rel_validation_deadline_h",
    "value": "48",
    "description": "Hours after production approval for reliability to validate"
   },
   {
    "key": "daily_meeting_time",
    "value": "09:00",
    "description": "Time of the daily meeting (HH:MM)"
   },
   {
    "key": "shift_entry_from",
    "value": "2026-10-01",
    "description": "First date entered through shift reports; earlier downtime stays as uploaded"
   }
  ],
  "roles": [
   {
    "role_id": "ROLE-ADMIN",
    "name": "Admin",
    "description": "Everything, including users and settings"
   },
   {
    "role_id": "ROLE-MGR",
    "name": "Manager",
    "description": "Views dashboards and master data"
   },
   {
    "role_id": "ROLE-ENG",
    "name": "Engineer",
    "description": "Uploads data, edits events and master data"
   },
   {
    "role_id": "ROLE-VIEW",
    "name": "Viewer",
    "description": "Views dashboards; never edits"
   },
   {
    "role_id": "ROLE-SHIFT",
    "name": "Shift leader",
    "description": "Enters the shift report of the assigned areas; views dashboards"
   },
   {
    "role_id": "ROLE-PROD",
    "name": "Production manager",
    "description": "Reviews and approves shift reports; daily meeting"
   },
   {
    "role_id": "ROLE-REL",
    "name": "Reliability engineer",
    "description": "Validates shift stoppages before they become downtime; edits events and master data"
   },
   {
    "role_id": "ROLE-QC",
    "name": "Quality engineer",
    "description": "Enters and validates laboratory results and quality limits; views dashboards"
   }
  ],
  "tabAccess": {
   "ROLE-ADMIN": {
    "overview": "Edit",
    "pareto": "Edit",
    "repeats": "Edit",
    "reliability": "Edit",
    "reports": "Edit",
    "actions": "Edit",
    "events": "Edit",
    "upload": "Edit",
    "master": "Edit",
    "settings": "Edit",
    "users": "Edit",
    "shift": "Edit",
    "daily": "Edit",
    "dispatch": "Edit"
   },
   "ROLE-MGR": {
    "overview": "View",
    "pareto": "View",
    "repeats": "View",
    "reliability": "View",
    "reports": "Edit",
    "actions": "Edit",
    "events": "View",
    "upload": "Hidden",
    "master": "View",
    "settings": "Hidden",
    "users": "Hidden",
    "shift": "View",
    "daily": "View",
    "dispatch": "Edit"
   },
   "ROLE-ENG": {
    "overview": "View",
    "pareto": "View",
    "repeats": "View",
    "reliability": "View",
    "reports": "View",
    "actions": "Edit",
    "events": "Edit",
    "upload": "Edit",
    "master": "Edit",
    "settings": "Hidden",
    "users": "Hidden",
    "shift": "View",
    "daily": "View",
    "dispatch": "View"
   },
   "ROLE-VIEW": {
    "overview": "View",
    "pareto": "View",
    "repeats": "View",
    "reliability": "View",
    "reports": "View",
    "actions": "View",
    "events": "View",
    "upload": "Hidden",
    "master": "Hidden",
    "settings": "Hidden",
    "users": "Hidden",
    "shift": "Hidden",
    "daily": "View",
    "dispatch": "View"
   },
   "ROLE-SHIFT": {
    "overview": "View",
    "pareto": "View",
    "repeats": "View",
    "reliability": "View",
    "reports": "View",
    "actions": "View",
    "events": "View",
    "upload": "Hidden",
    "master": "Hidden",
    "settings": "Hidden",
    "users": "Hidden",
    "shift": "Edit",
    "daily": "View",
    "dispatch": "View"
   },
   "ROLE-PROD": {
    "overview": "View",
    "pareto": "View",
    "repeats": "View",
    "reliability": "View",
    "reports": "Edit",
    "actions": "Edit",
    "events": "View",
    "upload": "Hidden",
    "master": "Hidden",
    "settings": "Hidden",
    "users": "Hidden",
    "shift": "Edit",
    "daily": "View",
    "dispatch": "Edit"
   },
   "ROLE-REL": {
    "overview": "View",
    "pareto": "View",
    "repeats": "View",
    "reliability": "View",
    "reports": "View",
    "actions": "Edit",
    "events": "Edit",
    "upload": "Edit",
    "master": "Edit",
    "settings": "Hidden",
    "users": "Hidden",
    "shift": "Edit",
    "daily": "View",
    "dispatch": "View"
   },
   "ROLE-QC": {
    "overview": "View",
    "pareto": "View",
    "repeats": "View",
    "reliability": "View",
    "reports": "View",
    "actions": "View",
    "events": "View",
    "upload": "Hidden",
    "master": "Hidden",
    "settings": "Hidden",
    "users": "Hidden",
    "shift": "Hidden",
    "daily": "View",
    "dispatch": "View"
   }
  },
  "classifications": [
   {
    "code": "PRO",
    "name": "Production",
    "is_incident": true,
    "sort_order": 1
   },
   {
    "code": "MEC",
    "name": "Mechanical",
    "is_incident": true,
    "sort_order": 2
   },
   {
    "code": "ELE",
    "name": "Electrical",
    "is_incident": true,
    "sort_order": 3
   },
   {
    "code": "AUT",
    "name": "Automation",
    "is_incident": true,
    "sort_order": 4
   },
   {
    "code": "PL",
    "name": "Planned",
    "is_incident": false,
    "sort_order": 5
   },
   {
    "code": "CIR",
    "name": "Circumstantial",
    "is_incident": false,
    "sort_order": 6
   }
  ],
  "lines": [
   {
    "line_id": "L.1",
    "name": "Line 1",
    "sort_order": 1,
    "active": true
   },
   {
    "line_id": "L.2",
    "name": "Line 2",
    "sort_order": 2,
    "active": true
   }
  ],
  "areas": [
   {
    "area_id": "CR",
    "name": "Crusher",
    "line_id": "L.1",
    "sort_order": 1,
    "in_downtime_sheet": true
   },
   {
    "area_id": "RM.1",
    "name": "Raw Mill 1",
    "line_id": "L.1",
    "sort_order": 2,
    "in_downtime_sheet": true
   },
   {
    "area_id": "K.1",
    "name": "Kiln 1",
    "line_id": "L.1",
    "sort_order": 3,
    "in_downtime_sheet": true
   },
   {
    "area_id": "FM.1",
    "name": "Coal (fuel) Mill 1",
    "line_id": "L.1",
    "sort_order": 4,
    "in_downtime_sheet": true,
    "notes": "Name to be confirmed"
   },
   {
    "area_id": "HD",
    "name": "Hot Disc",
    "line_id": "L.1",
    "sort_order": 5,
    "in_downtime_sheet": true
   },
   {
    "area_id": "CM.1",
    "name": "Cement Mill 1",
    "line_id": "L.1",
    "sort_order": 6,
    "in_downtime_sheet": true
   },
   {
    "area_id": "CM.2",
    "name": "Cement Mill 2",
    "line_id": "L.1",
    "sort_order": 7,
    "in_downtime_sheet": true
   },
   {
    "area_id": "PK.1",
    "name": "Packing 1",
    "line_id": "L.1",
    "sort_order": 8,
    "in_downtime_sheet": false
   },
   {
    "area_id": "HY.1",
    "name": "Hydrogen (Line 1)",
    "line_id": "L.1",
    "sort_order": 9,
    "in_downtime_sheet": false
   },
   {
    "area_id": "RM.2",
    "name": "Raw Mill 2",
    "line_id": "L.2",
    "sort_order": 10,
    "in_downtime_sheet": true
   },
   {
    "area_id": "K.2",
    "name": "Kiln 2",
    "line_id": "L.2",
    "sort_order": 11,
    "in_downtime_sheet": true
   },
   {
    "area_id": "FM.2",
    "name": "Coal (fuel) Mill 2",
    "line_id": "L.2",
    "sort_order": 12,
    "in_downtime_sheet": true,
    "notes": "Name to be confirmed"
   },
   {
    "area_id": "AFR",
    "name": "AFR (old system)",
    "line_id": "L.2",
    "sort_order": 13,
    "in_downtime_sheet": true
   },
   {
    "area_id": "AFR new",
    "name": "AFR (new system)",
    "line_id": "L.2",
    "sort_order": 14,
    "in_downtime_sheet": true,
    "notes": "Equipment list to be supplied"
   },
   {
    "area_id": "SHR",
    "name": "AF Shredding",
    "line_id": "L.2",
    "sort_order": 15,
    "in_downtime_sheet": true
   },
   {
    "area_id": "CM.3",
    "name": "Cement Mill 3",
    "line_id": "L.2",
    "sort_order": 16,
    "in_downtime_sheet": true
   },
   {
    "area_id": "CM.4",
    "name": "Cement Mill 4",
    "line_id": "L.2",
    "sort_order": 17,
    "in_downtime_sheet": true
   },
   {
    "area_id": "PK.2",
    "name": "Packing 2",
    "line_id": "L.2",
    "sort_order": 18,
    "in_downtime_sheet": false
   },
   {
    "area_id": "HY.2",
    "name": "Hydrogen (Line 2)",
    "line_id": "L.2",
    "sort_order": 19,
    "in_downtime_sheet": false
   }
  ],
  "contractors": [
   {
    "contractor_id": "RHI",
    "name": "RHI",
    "areas": "CR,RM.1,RM.2,K.1,K.2,HD,AFR,AFR new,SHR,FM.1,FM.2,HY.1,HY.2",
    "kind": "contractor",
    "active": true,
    "sort_order": 1,
    "default_assignee": ""
   },
   {
    "contractor_id": "ASEC",
    "name": "ASEC",
    "areas": "CM.1,CM.2,CM.3,CM.4,PK.1,PK.2",
    "kind": "contractor",
    "active": true,
    "sort_order": 2,
    "default_assignee": ""
   },
   {
    "contractor_id": "MEC",
    "name": "Mechanical",
    "areas": "",
    "kind": "internal",
    "active": true,
    "sort_order": 3,
    "default_assignee": ""
   },
   {
    "contractor_id": "ELE",
    "name": "Electrical",
    "areas": "",
    "kind": "internal",
    "active": true,
    "sort_order": 4,
    "default_assignee": ""
   },
   {
    "contractor_id": "AUT",
    "name": "Automation",
    "areas": "",
    "kind": "internal",
    "active": true,
    "sort_order": 5,
    "default_assignee": ""
   },
   {
    "contractor_id": "PRO",
    "name": "Production",
    "areas": "",
    "kind": "internal",
    "active": true,
    "sort_order": 6,
    "default_assignee": ""
   }
  ],
  "taskTemplates": [
   {
    "template_id": "TT-REPEAT",
    "name": "Repeated failure",
    "applies_to": "auto_repeat,auto_chronic",
    "active": true,
    "sort_order": 1,
    "steps": [
     {
      "title": "Repair",
      "default_owner": "area_contractor",
      "due_offset_days": 2,
      "needs_stop": true,
      "est_stop_h": null
     },
     {
      "title": "Root cause (5-why)",
      "default_owner": "MEC",
      "due_offset_days": 7,
      "needs_stop": false,
      "est_stop_h": null
     },
     {
      "title": "Corrective action",
      "default_owner": "area_contractor",
      "due_offset_days": 21,
      "needs_stop": true,
      "est_stop_h": null
     },
     {
      "title": "Spare parts",
      "default_owner": "MEC",
      "due_offset_days": 14,
      "needs_stop": false,
      "est_stop_h": null
     }
    ]
   },
   {
    "template_id": "TT-LONGSTOP",
    "name": "Long stop",
    "applies_to": "auto_long_stop",
    "active": true,
    "sort_order": 2,
    "steps": [
     {
      "title": "Restore and report",
      "default_owner": "area_contractor",
      "due_offset_days": 1,
      "needs_stop": false,
      "est_stop_h": null
     },
     {
      "title": "Root cause (5-why)",
      "default_owner": "MEC",
      "due_offset_days": 7,
      "needs_stop": false,
      "est_stop_h": null
     },
     {
      "title": "Corrective action",
      "default_owner": "area_contractor",
      "due_offset_days": 21,
      "needs_stop": true,
      "est_stop_h": null
     }
    ]
   },
   {
    "template_id": "TT-PLANNED",
    "name": "Planned overrun",
    "applies_to": "auto_planned_overrun",
    "active": true,
    "sort_order": 3,
    "steps": [
     {
      "title": "Review planned work",
      "default_owner": "PRO",
      "due_offset_days": 7,
      "needs_stop": false,
      "est_stop_h": null
     },
     {
      "title": "Adjust allowance or plan",
      "default_owner": "PRO",
      "due_offset_days": 14,
      "needs_stop": false,
      "est_stop_h": null
     }
    ]
   }
  ],
  "shifts": [
   {
    "shift_id": "D",
    "name": "Day",
    "start_time": "08:00",
    "end_time": "20:00",
    "sort_order": 1,
    "active": true,
    "notes": ""
   },
   {
    "shift_id": "N",
    "name": "Night",
    "start_time": "20:00",
    "end_time": "08:00",
    "sort_order": 2,
    "active": true,
    "notes": "Crosses midnight; belongs to the date it starts"
   }
  ],
  "kpiDefinitions": [
   {
    "kpi_id": "T_H",
    "name": "Scheduled hours",
    "category": "reliability",
    "unit": "h",
    "formula": "Calendar hours of the period x scheduled hours per day ÷ 24 (today 24 h a day, 7 days a week)",
    "aggregation": "sum",
    "better": "none",
    "decimals": 1,
    "applies_to": "all",
    "nrs_formula": "Available RRHH = days in month x 24",
    "app_formula": "scheduled_hours_per_day x scheduled days",
    "decision": "Agreed as proposed. Same today. Decide whether an area that is not needed (e.g. a mill with full silos) is still scheduled.",
    "status": "approved",
    "approved_at": "2026-10-19",
    "approved_by": ""
   },
   {
    "kpi_id": "STOP_H",
    "name": "Stoppage hours",
    "category": "reliability",
    "unit": "h",
    "formula": "Hours stopped in the period; stops that overlap in one area are counted once",
    "aggregation": "sum",
    "better": "lower",
    "decimals": 1,
    "applies_to": "all",
    "nrs_formula": "SUMIFS of TOTAL STOPPAGE DURATION (h) - overlapping rows are added twice",
    "app_formula": "Merged per area, so overlaps count once (priority PL > INC > CIR)",
    "decision": "Agreed: overlaps counted once.",
    "status": "approved",
    "approved_at": "2026-10-19",
    "approved_by": ""
   },
   {
    "kpi_id": "RUN_H",
    "name": "Running hours",
    "category": "reliability",
    "unit": "h",
    "formula": "Scheduled hours − stoppage hours",
    "aggregation": "sum",
    "better": "higher",
    "decimals": 1,
    "applies_to": "all",
    "nrs_formula": "Available RRHH − Stoppage Time",
    "app_formula": "T − (PL + INC + CIR), overlaps once",
    "decision": "Agreed as proposed. Same idea. Later compare with DCS running hours (see RH_DCS) as a data check.",
    "status": "approved",
    "approved_at": "2026-10-19",
    "approved_by": ""
   },
   {
    "kpi_id": "INC_H",
    "name": "Incident hours",
    "category": "reliability",
    "unit": "h",
    "formula": "Hours of stops with criticality INC (PRO, MEC, ELE, AUT)",
    "aggregation": "sum",
    "better": "lower",
    "decimals": 1,
    "applies_to": "all",
    "nrs_formula": "SUMIFS ... CRITICALITY = \"INC\"",
    "app_formula": "Classification PRO/MEC/ELE/AUT",
    "decision": "Agreed as proposed. Same.",
    "status": "approved",
    "approved_at": "2026-10-19",
    "approved_by": ""
   },
   {
    "kpi_id": "PL_H",
    "name": "Planned hours",
    "category": "reliability",
    "unit": "h",
    "formula": "Hours of planned stops (PL)",
    "aggregation": "sum",
    "better": "none",
    "decimals": 1,
    "applies_to": "all",
    "nrs_formula": "SUMIFS ... classification PL",
    "app_formula": "Classification PL",
    "decision": "Agreed as proposed. Same.",
    "status": "approved",
    "approved_at": "2026-10-19",
    "approved_by": ""
   },
   {
    "kpi_id": "CIR_H",
    "name": "Circumstantial hours",
    "category": "reliability",
    "unit": "h",
    "formula": "Hours of circumstantial stops (CIR: power cut, gas or water shortage, full silos ...)",
    "aggregation": "sum",
    "better": "lower",
    "decimals": 1,
    "applies_to": "all",
    "nrs_formula": "SUMIFS ... classification CIR",
    "app_formula": "Classification CIR",
    "decision": "Agreed as proposed. Same.",
    "status": "approved",
    "approved_at": "2026-10-19",
    "approved_by": ""
   },
   {
    "kpi_id": "FAILURES",
    "name": "Stop frequency (failures)",
    "category": "reliability",
    "unit": "count",
    "formula": "Number of failure events: Freq = 1, Failure = YES and not PL or CIR",
    "aggregation": "sum",
    "better": "lower",
    "decimals": 0,
    "applies_to": "all",
    "nrs_formula": "COUNTIFS Failure = \"YES\" (every row, including continuation rows and PL/CIR rows marked YES)",
    "app_formula": "Freq = 1, Failure = YES, not PL/CIR",
    "decision": "Agreed: app rule (Freq = 1, Failure = YES, not PL/CIR).",
    "status": "approved",
    "approved_at": "2026-10-19",
    "approved_by": ""
   },
   {
    "kpi_id": "UF",
    "name": "Utilization factor (UF)",
    "category": "reliability",
    "unit": "%",
    "formula": "Running hours ÷ scheduled hours",
    "aggregation": "ratio_of_sums",
    "better": "higher",
    "decimals": 1,
    "applies_to": "all",
    "nrs_formula": "Run ÷ (Run + Stop) = Run ÷ RRHH",
    "app_formula": "Run ÷ T (availability basis A)",
    "decision": "Agreed: ratio of sums.",
    "status": "approved",
    "approved_at": "2026-10-19",
    "approved_by": ""
   },
   {
    "kpi_id": "RF",
    "name": "Reliability factor (RF)",
    "category": "reliability",
    "unit": "%",
    "formula": "Running hours ÷ (running hours + incident hours)",
    "aggregation": "ratio_of_sums",
    "better": "higher",
    "decimals": 1,
    "applies_to": "all",
    "nrs_formula": "IFERROR(Run ÷ (Run + INC), 0)",
    "app_formula": "Run ÷ (Run + INC) (availability basis C)",
    "decision": "Agreed: no value (—) when there is nothing to divide.",
    "status": "approved",
    "approved_at": "2026-10-19",
    "approved_by": ""
   },
   {
    "kpi_id": "EA",
    "name": "Equipment availability (EA)",
    "category": "reliability",
    "unit": "%",
    "formula": "(Running hours + circumstantial hours) ÷ scheduled hours",
    "aggregation": "ratio_of_sums",
    "better": "higher",
    "decimals": 1,
    "applies_to": "all",
    "nrs_formula": "(Run + CIR) ÷ (Run + Stop)",
    "app_formula": "Not in the app yet",
    "decision": "Agreed as NRS: planned stops count as lost time.",
    "status": "approved",
    "approved_at": "2026-10-19",
    "approved_by": ""
   },
   {
    "kpi_id": "MTBF",
    "name": "Mean time between failures (MTBF)",
    "category": "reliability",
    "unit": "h",
    "formula": "Running hours ÷ failure events",
    "aggregation": "ratio_of_sums",
    "better": "higher",
    "decimals": 1,
    "applies_to": "all",
    "nrs_formula": "IFERROR(Run ÷ Stop Frequency, MTBF TARGET)",
    "app_formula": "Run ÷ failure events; no failures = no value",
    "decision": "Agreed: \"no failures\" instead of the target.",
    "status": "approved",
    "approved_at": "2026-10-19",
    "approved_by": ""
   },
   {
    "kpi_id": "MTTR",
    "name": "Mean time to repair (MTTR)",
    "category": "reliability",
    "unit": "h",
    "formula": "Failure-event hours ÷ failure events",
    "aggregation": "ratio_of_sums",
    "better": "lower",
    "decimals": 2,
    "applies_to": "all",
    "nrs_formula": "IFERROR(INC hours ÷ Stop Frequency, MTTR TARGET)",
    "app_formula": "Duration of failure events ÷ failure events",
    "decision": "Agreed: failure-event hours ÷ failure events (same events as MTBF). Incident hours stay visible as INC_H.",
    "status": "approved",
    "approved_at": "2026-10-19",
    "approved_by": ""
   },
   {
    "kpi_id": "PROD_T",
    "name": "Production",
    "category": "production",
    "unit": "t",
    "formula": "Tons produced by the area in the period (DCS weigh feeders + recorded correction)",
    "aggregation": "sum",
    "better": "higher",
    "decimals": 0,
    "applies_to": "CR,RM.1,RM.2,FM.1,FM.2,K.1,K.2,CM.1,CM.2,CM.3,CM.4",
    "nrs_formula": "CR: crusher feed + correction. RM: weigh feeders split OPC/SRC by the mix of the day, dry basis. FM: WF450 + WF550 by coal/petcoke mix. K: see CLK_T. CM: weigh feeders to each silo x running-hour factor",
    "app_formula": "Not in the app yet",
    "decision": "Agreed as proposed. Each area keeps the NRS method; every correction gets a reason and an approver (production_corrections).",
    "status": "approved",
    "approved_at": "2026-10-19",
    "approved_by": ""
   },
   {
    "kpi_id": "CLK_T",
    "name": "Clinker production",
    "category": "production",
    "unit": "t",
    "formula": "(Kiln feed + correction) ÷ clinker factor + ash from fuels",
    "aggregation": "sum",
    "better": "higher",
    "decimals": 0,
    "applies_to": "K.1,K.2",
    "nrs_formula": "Prod WO Ash = (kiln feed + correction ...) ÷ CF (PLG-CF, Manual-CF or Calculated-CF); Prod = Prod WO Ash + fuel ash tons",
    "app_formula": "Not in the app yet",
    "decision": "Agreed as proposed. Agree which clinker factor is used and who may change it; store it per day with its source.",
    "status": "approved",
    "approved_at": "2026-10-19",
    "approved_by": ""
   },
   {
    "kpi_id": "RH_DCS",
    "name": "Running hours (DCS)",
    "category": "production",
    "unit": "h",
    "formula": "Running hours counted by the DCS + recorded correction",
    "aggregation": "sum",
    "better": "higher",
    "decimals": 1,
    "applies_to": "CR,RM.1,RM.2,FM.1,FM.2,K.1,K.2,CM.1,CM.2,CM.3,CM.4",
    "nrs_formula": "Tag + correction table",
    "app_formula": "Not in the app yet",
    "decision": "Agreed as proposed. Compare every day with RUN_H from the stoppage log; a gap above a set limit raises a data check.",
    "status": "approved",
    "approved_at": "2026-10-19",
    "approved_by": ""
   },
   {
    "kpi_id": "RATE",
    "name": "Production rate",
    "category": "production",
    "unit": "t/h",
    "formula": "Production ÷ DCS running hours",
    "aggregation": "ratio_of_sums",
    "better": "higher",
    "decimals": 1,
    "applies_to": "CR,RM.1,RM.2,FM.1,FM.2,K.1,K.2,CM.1,CM.2,CM.3,CM.4",
    "nrs_formula": "Prod ÷ R H (0 when RH = 0)",
    "app_formula": "Not in the app yet",
    "decision": "Agreed as proposed. Ratio of sums for month and year.",
    "status": "approved",
    "approved_at": "2026-10-19",
    "approved_by": ""
   },
   {
    "kpi_id": "PF",
    "name": "Performance factor (PF)",
    "category": "production",
    "unit": "%",
    "formula": "Actual rate ÷ target rate",
    "aggregation": "ratio_of_sums",
    "better": "higher",
    "decimals": 1,
    "applies_to": "CR,RM.1,RM.2,FM.1,FM.2,K.1,K.2,CM.1,CM.2,CM.3,CM.4",
    "nrs_formula": "Actual rate ÷ target rate",
    "app_formula": "Not in the app yet",
    "decision": "Agreed as proposed. Target rate per area and month in kpi_targets.",
    "status": "approved",
    "approved_at": "2026-10-19",
    "approved_by": ""
   },
   {
    "kpi_id": "OEE",
    "name": "Overall equipment effectiveness (OEE)",
    "category": "production",
    "unit": "%",
    "formula": "UF x PF x quality rate",
    "aggregation": "ratio_of_sums",
    "better": "higher",
    "decimals": 1,
    "applies_to": "K.1,K.2,CM.1,CM.2,CM.3,CM.4",
    "nrs_formula": "Not in NRS",
    "app_formula": "Not in the app",
    "decision": "Optional, still open: needs an agreed quality rate (e.g. 1 − isolated clinker ÷ clinker).",
    "status": "draft",
    "approved_by": "",
    "approved_at": ""
   },
   {
    "kpi_id": "SPC",
    "name": "Specific power consumption (SPC)",
    "category": "energy",
    "unit": "kWh/t",
    "formula": "Total power (process + auxiliary) x 1000 ÷ production",
    "aggregation": "ratio_of_sums",
    "better": "lower",
    "decimals": 1,
    "applies_to": "CR,RM.1,RM.2,FM.1,FM.2,K.1,K.2,CM.1,CM.2,CM.3,CM.4",
    "nrs_formula": "Total Pwr x 1000 ÷ Prod; kiln sets values above 100 to 0",
    "app_formula": "Not in the app yet",
    "decision": "Agreed: flag above the limit, never 0.",
    "status": "approved",
    "approved_at": "2026-10-19",
    "approved_by": ""
   },
   {
    "kpi_id": "SHC",
    "name": "Specific heat consumption (SHC)",
    "category": "fuel",
    "unit": "kcal/kg clinker",
    "formula": "(Fossil heat + alternative-fuel heat) ÷ (clinker x 1000)",
    "aggregation": "ratio_of_sums",
    "better": "lower",
    "decimals": 0,
    "applies_to": "K.1,K.2",
    "nrs_formula": "SUM(fossil, AF heat) ÷ (Prod x 1000); values above 1500 set to 0",
    "app_formula": "Not in the app yet",
    "decision": "Agreed: flag above the limit, never 0; each fuel uses its own volume.",
    "status": "approved",
    "approved_at": "2026-10-19",
    "approved_by": ""
   },
   {
    "kpi_id": "TSR",
    "name": "Thermal substitution rate (TSR)",
    "category": "fuel",
    "unit": "%",
    "formula": "Alternative-fuel heat ÷ total heat",
    "aggregation": "ratio_of_sums",
    "better": "higher",
    "decimals": 1,
    "applies_to": "K.1,K.2",
    "nrs_formula": "AF heat ÷ (fossil + AF heat)",
    "app_formula": "Not in the app yet",
    "decision": "Agreed as proposed. Same.",
    "status": "approved",
    "approved_at": "2026-10-19",
    "approved_by": ""
   },
   {
    "kpi_id": "SWC",
    "name": "Specific water consumption (SWC)",
    "category": "water",
    "unit": "l/t",
    "formula": "Water (m³) x 1000 ÷ production",
    "aggregation": "ratio_of_sums",
    "better": "lower",
    "decimals": 1,
    "applies_to": "RM.1,RM.2,K.1,K.2,CM.1,CM.2,CM.3,CM.4",
    "nrs_formula": "Water x 1000 ÷ Prod; kiln sets values above 500 to 0",
    "app_formula": "Not in the app yet",
    "decision": "Agreed: flag above the limit, never 0.",
    "status": "approved",
    "approved_at": "2026-10-19",
    "approved_by": ""
   },
   {
    "kpi_id": "GA",
    "name": "Grinding aid dosage",
    "category": "materials",
    "unit": "g/t",
    "formula": "Grinding aid grams ÷ cement tons",
    "aggregation": "ratio_of_sums",
    "better": "none",
    "decimals": 0,
    "applies_to": "CM.1,CM.2,CM.3,CM.4",
    "nrs_formula": "Dosage g/day ÷ tons to the silos",
    "app_formula": "Not in the app yet",
    "decision": "Agreed as proposed. Same.",
    "status": "approved",
    "approved_at": "2026-10-19",
    "approved_by": ""
   },
   {
    "kpi_id": "CLK_FACTOR",
    "name": "Clinker in cement",
    "category": "materials",
    "unit": "%",
    "formula": "Clinker tons ÷ cement tons",
    "aggregation": "ratio_of_sums",
    "better": "lower",
    "decimals": 1,
    "applies_to": "CM.1,CM.2,CM.3,CM.4",
    "nrs_formula": "From the cement mill material balance",
    "app_formula": "Not in the app yet",
    "decision": "Agreed as proposed. Same.",
    "status": "approved",
    "approved_at": "2026-10-19",
    "approved_by": ""
   },
   {
    "kpi_id": "Q_LSF_SD",
    "name": "Raw meal LSF standard deviation",
    "category": "quality",
    "unit": "-",
    "formula": "Standard deviation of the raw meal LSF results of the period",
    "aggregation": "std_dev",
    "better": "lower",
    "decimals": 2,
    "applies_to": "RM.1,RM.2",
    "nrs_formula": "Not in NRS (QCX daily averages only)",
    "app_formula": "New",
    "decision": "Needs each sample (hourly), not daily averages: the spread of daily averages hides most of the variation.",
    "status": "draft",
    "approved_by": "",
    "approved_at": ""
   },
   {
    "kpi_id": "Q_KF_LSF_SD",
    "name": "Kiln feed LSF standard deviation",
    "category": "quality",
    "unit": "-",
    "formula": "Standard deviation of the kiln feed LSF results",
    "aggregation": "std_dev",
    "better": "lower",
    "decimals": 2,
    "applies_to": "K.1,K.2",
    "nrs_formula": "Not in NRS (QCX daily averages only)",
    "app_formula": "New",
    "decision": "Main measure of kiln feed stability.",
    "status": "draft",
    "approved_by": "",
    "approved_at": ""
   },
   {
    "kpi_id": "Q_FL_AVG",
    "name": "Clinker free lime",
    "category": "quality",
    "unit": "%",
    "formula": "Average of the clinker free lime results",
    "aggregation": "average",
    "better": "none",
    "decimals": 2,
    "applies_to": "K.1,K.2",
    "nrs_formula": "Not in NRS (QCX daily averages only)",
    "app_formula": "New",
    "decision": "Too high = under-burnt, too low = over-burnt (fuel lost).",
    "status": "draft",
    "approved_by": "",
    "approved_at": ""
   },
   {
    "kpi_id": "Q_FL_IN_SPEC",
    "name": "Clinker free lime in specification",
    "category": "quality",
    "unit": "%",
    "formula": "Results inside the free lime limits ÷ all results",
    "aggregation": "share_in_spec",
    "better": "higher",
    "decimals": 1,
    "applies_to": "K.1,K.2",
    "nrs_formula": "Not in NRS (QCX daily averages only)",
    "app_formula": "New",
    "decision": "Limits from quality_parameters.",
    "status": "draft",
    "approved_by": "",
    "approved_at": ""
   },
   {
    "kpi_id": "Q_C3S_AVG",
    "name": "Clinker C3S",
    "category": "quality",
    "unit": "%",
    "formula": "Average of the clinker C3S results",
    "aggregation": "average",
    "better": "higher",
    "decimals": 1,
    "applies_to": "K.1,K.2",
    "nrs_formula": "Not in NRS (QCX daily averages only)",
    "app_formula": "New",
    "decision": "",
    "status": "draft",
    "approved_by": "",
    "approved_at": ""
   },
   {
    "kpi_id": "Q_HM_SO3",
    "name": "Hot meal SO3",
    "category": "quality",
    "unit": "%",
    "formula": "Average of the hot meal SO3 results",
    "aggregation": "average",
    "better": "lower",
    "decimals": 2,
    "applies_to": "K.1,K.2",
    "nrs_formula": "Not in NRS (QCX daily averages only)",
    "app_formula": "New",
    "decision": "Early warning of build-up in the preheater.",
    "status": "draft",
    "approved_by": "",
    "approved_at": ""
   },
   {
    "kpi_id": "Q_ISO_CLK",
    "name": "Isolated (off-spec) clinker",
    "category": "quality",
    "unit": "%",
    "formula": "Isolated clinker tons ÷ clinker tons",
    "aggregation": "ratio_of_sums",
    "better": "lower",
    "decimals": 2,
    "applies_to": "K.1,K.2",
    "nrs_formula": "Not in NRS (QCX daily averages only)",
    "app_formula": "New",
    "decision": "From the kiln isolated-clinker value (NRS column Isolated Clinker).",
    "status": "draft",
    "approved_by": "",
    "approved_at": ""
   },
   {
    "kpi_id": "Q_FUEL_FINE",
    "name": "Coal and petcoke fineness",
    "category": "quality",
    "unit": "% residue",
    "formula": "Average sieve residue of the ground coal / petcoke",
    "aggregation": "average",
    "better": "lower",
    "decimals": 1,
    "applies_to": "FM.1,FM.2",
    "nrs_formula": "Not in NRS (QCX daily averages only)",
    "app_formula": "New",
    "decision": "",
    "status": "draft",
    "approved_by": "",
    "approved_at": ""
   },
   {
    "kpi_id": "Q_BLAINE_SD",
    "name": "Cement Blaine standard deviation",
    "category": "quality",
    "unit": "cm²/g",
    "formula": "Standard deviation of the cement Blaine results, per product",
    "aggregation": "std_dev",
    "better": "lower",
    "decimals": 0,
    "applies_to": "CM.1,CM.2,CM.3,CM.4",
    "nrs_formula": "Not in NRS (QCX daily averages only)",
    "app_formula": "New",
    "decision": "Per cement type: OPC and SRC must not be mixed in one figure.",
    "status": "draft",
    "approved_by": "",
    "approved_at": ""
   },
   {
    "kpi_id": "Q_CEM_SO3_IN_SPEC",
    "name": "Cement SO3 in specification",
    "category": "quality",
    "unit": "%",
    "formula": "Cement SO3 results inside the limits ÷ all results",
    "aggregation": "share_in_spec",
    "better": "higher",
    "decimals": 1,
    "applies_to": "CM.1,CM.2,CM.3,CM.4",
    "nrs_formula": "Not in NRS (QCX daily averages only)",
    "app_formula": "New",
    "decision": "",
    "status": "draft",
    "approved_by": "",
    "approved_at": ""
   },
   {
    "kpi_id": "Q_CONFORMANCE",
    "name": "Quality conformance",
    "category": "quality",
    "unit": "%",
    "formula": "All results inside their specification ÷ all results with a specification",
    "aggregation": "share_in_spec",
    "better": "higher",
    "decimals": 1,
    "applies_to": "all",
    "nrs_formula": "Not in NRS (QCX daily averages only)",
    "app_formula": "New",
    "decision": "One summary figure per area for the daily meeting.",
    "status": "draft",
    "approved_by": "",
    "approved_at": ""
   },
   {
    "kpi_id": "MAT_CLK_BAL",
    "name": "Clinker balance gap",
    "category": "materials",
    "unit": "%",
    "formula": "(Clinker produced − clinker used by the mills − change in clinker stock) ÷ clinker produced",
    "aggregation": "ratio_of_sums",
    "better": "none",
    "decimals": 1,
    "applies_to": "K.1,K.2,CM.1,CM.2,CM.3,CM.4",
    "nrs_formula": "Not in NRS",
    "app_formula": "New",
    "decision": "Shows whether kiln production, mill consumption and stock agree; a large gap means one of them is wrong.",
    "status": "draft",
    "approved_by": "",
    "approved_at": ""
   },
   {
    "kpi_id": "STK_CLK_DAYS",
    "name": "Clinker stock cover",
    "category": "stock",
    "unit": "days",
    "formula": "Clinker stock ÷ average daily clinker use of the last 30 days",
    "aggregation": "last",
    "better": "none",
    "decimals": 1,
    "applies_to": "all",
    "nrs_formula": "Not in NRS",
    "app_formula": "New",
    "decision": "Value at the end of the period.",
    "status": "draft",
    "approved_by": "",
    "approved_at": ""
   },
   {
    "kpi_id": "DQ_ON_TIME",
    "name": "Data on time",
    "category": "data",
    "unit": "%",
    "formula": "Required values and reports entered and approved by their deadline ÷ all required",
    "aggregation": "ratio_of_sums",
    "better": "higher",
    "decimals": 1,
    "applies_to": "all",
    "nrs_formula": "Not in NRS",
    "app_formula": "New",
    "decision": "Measures the reporting itself; shown per area and per duty.",
    "status": "draft",
    "approved_by": "",
    "approved_at": ""
   },
   {
    "kpi_id": "DQ_OPEN_CHECKS",
    "name": "Open data checks",
    "category": "data",
    "unit": "count",
    "formula": "Data checks still open at the end of the period",
    "aggregation": "last",
    "better": "lower",
    "decimals": 0,
    "applies_to": "all",
    "nrs_formula": "Not in NRS",
    "app_formula": "New",
    "decision": "",
    "status": "draft",
    "approved_by": "",
    "approved_at": ""
   }
  ],
  "qualityParameters": [
   {
    "param_id": "RM.1.RAW_MEAL.LSF",
    "area_id": "RM.1",
    "material": "raw_meal",
    "name": "LSF",
    "unit": "-",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 80,
    "valid_max": 120,
    "samples_per_day": null,
    "qcx_column": "RM1_LSF",
    "sort_order": 1,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "RM.1.RAW_MEAL.SM",
    "area_id": "RM.1",
    "material": "raw_meal",
    "name": "SM",
    "unit": "-",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 1,
    "valid_max": 4,
    "samples_per_day": null,
    "qcx_column": "RM1_SM",
    "sort_order": 2,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "RM.1.RAW_MEAL.ALM",
    "area_id": "RM.1",
    "material": "raw_meal",
    "name": "AM",
    "unit": "-",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0.5,
    "valid_max": 3,
    "samples_per_day": null,
    "qcx_column": "RM1_ALM",
    "sort_order": 3,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "RM.1.RAW_MEAL.SIEVE",
    "area_id": "RM.1",
    "material": "raw_meal",
    "name": "Sieve residue",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 40,
    "samples_per_day": null,
    "qcx_column": "RM1_Sieve",
    "sort_order": 4,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "RM.1.RAW_MEAL.MGO",
    "area_id": "RM.1",
    "material": "raw_meal",
    "name": "MgO",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 6,
    "samples_per_day": null,
    "qcx_column": "RM1_MgO",
    "sort_order": 5,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "RM.1.RAW_MEAL.SO3",
    "area_id": "RM.1",
    "material": "raw_meal",
    "name": "SO3",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 10,
    "samples_per_day": null,
    "qcx_column": "RM1_SO3",
    "sort_order": 6,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "RM.1.RAW_MEAL.CL",
    "area_id": "RM.1",
    "material": "raw_meal",
    "name": "Cl",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 3,
    "samples_per_day": null,
    "qcx_column": "RM1_Cl",
    "sort_order": 7,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "RM.2.RAW_MEAL.LSF",
    "area_id": "RM.2",
    "material": "raw_meal",
    "name": "LSF",
    "unit": "-",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 80,
    "valid_max": 120,
    "samples_per_day": null,
    "qcx_column": "RM2_LSF",
    "sort_order": 8,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "RM.2.RAW_MEAL.SM",
    "area_id": "RM.2",
    "material": "raw_meal",
    "name": "SM",
    "unit": "-",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 1,
    "valid_max": 4,
    "samples_per_day": null,
    "qcx_column": "RM2_SM",
    "sort_order": 9,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "RM.2.RAW_MEAL.ALM",
    "area_id": "RM.2",
    "material": "raw_meal",
    "name": "AM",
    "unit": "-",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0.5,
    "valid_max": 3,
    "samples_per_day": null,
    "qcx_column": "RM2_ALM",
    "sort_order": 10,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "RM.2.RAW_MEAL.SIEVE",
    "area_id": "RM.2",
    "material": "raw_meal",
    "name": "Sieve residue",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 40,
    "samples_per_day": null,
    "qcx_column": "RM2_Sieve",
    "sort_order": 11,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "RM.2.RAW_MEAL.MGO",
    "area_id": "RM.2",
    "material": "raw_meal",
    "name": "MgO",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 6,
    "samples_per_day": null,
    "qcx_column": "RM2_Mgo",
    "sort_order": 12,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "RM.2.RAW_MEAL.SO3",
    "area_id": "RM.2",
    "material": "raw_meal",
    "name": "SO3",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 10,
    "samples_per_day": null,
    "qcx_column": "RM2_SO3",
    "sort_order": 13,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "RM.2.RAW_MEAL.CL",
    "area_id": "RM.2",
    "material": "raw_meal",
    "name": "Cl",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 3,
    "samples_per_day": null,
    "qcx_column": "RM2_Cl",
    "sort_order": 14,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "K.1.KILN_FEED.LSF",
    "area_id": "K.1",
    "material": "kiln_feed",
    "name": "LSF",
    "unit": "-",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 80,
    "valid_max": 120,
    "samples_per_day": null,
    "qcx_column": "KF1_LSF",
    "sort_order": 15,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "K.1.KILN_FEED.SO3",
    "area_id": "K.1",
    "material": "kiln_feed",
    "name": "SO3",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 10,
    "samples_per_day": null,
    "qcx_column": "KF1_SO3",
    "sort_order": 16,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "K.1.KILN_FEED.CL",
    "area_id": "K.1",
    "material": "kiln_feed",
    "name": "Cl",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 3,
    "samples_per_day": null,
    "qcx_column": "KF1_CL",
    "sort_order": 17,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "K.1.CLINKER.LSF",
    "area_id": "K.1",
    "material": "clinker",
    "name": "LSF",
    "unit": "-",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 80,
    "valid_max": 120,
    "samples_per_day": null,
    "qcx_column": "CK1_LSF",
    "sort_order": 18,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "K.1.CLINKER.SO3",
    "area_id": "K.1",
    "material": "clinker",
    "name": "SO3",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 10,
    "samples_per_day": null,
    "qcx_column": "CK1_SO3",
    "sort_order": 19,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "K.1.CLINKER.FL",
    "area_id": "K.1",
    "material": "clinker",
    "name": "Free lime",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 6,
    "samples_per_day": null,
    "qcx_column": "CK1_FL",
    "sort_order": 20,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "K.1.CLINKER.C3S",
    "area_id": "K.1",
    "material": "clinker",
    "name": "C3S",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 30,
    "valid_max": 80,
    "samples_per_day": null,
    "qcx_column": "CK1_C3S",
    "sort_order": 21,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "K.1.CLINKER.C2S",
    "area_id": "K.1",
    "material": "clinker",
    "name": "C2S",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 40,
    "samples_per_day": null,
    "qcx_column": "CK1_C2S",
    "sort_order": 22,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "K.1.HOT_MEAL.SO3",
    "area_id": "K.1",
    "material": "hot_meal",
    "name": "SO3",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 10,
    "samples_per_day": null,
    "qcx_column": "HM1_SO3",
    "sort_order": 23,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "K.1.HOT_MEAL.CL",
    "area_id": "K.1",
    "material": "hot_meal",
    "name": "Cl",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 3,
    "samples_per_day": null,
    "qcx_column": "HM1_CL",
    "sort_order": 24,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "K.1.HOT_MEAL.VOLATILITY",
    "area_id": "K.1",
    "material": "hot_meal",
    "name": "SO3 volatility",
    "unit": "-",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 1,
    "samples_per_day": null,
    "qcx_column": "HM1_Volatility",
    "sort_order": 25,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "K.2.KILN_FEED.LSF",
    "area_id": "K.2",
    "material": "kiln_feed",
    "name": "LSF",
    "unit": "-",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 80,
    "valid_max": 120,
    "samples_per_day": null,
    "qcx_column": "KF2_LSF",
    "sort_order": 26,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "K.2.KILN_FEED.SO3",
    "area_id": "K.2",
    "material": "kiln_feed",
    "name": "SO3",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 10,
    "samples_per_day": null,
    "qcx_column": "KF2_SO3",
    "sort_order": 27,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "K.2.KILN_FEED.CL",
    "area_id": "K.2",
    "material": "kiln_feed",
    "name": "Cl",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 3,
    "samples_per_day": null,
    "qcx_column": "KF2_CL",
    "sort_order": 28,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "K.2.CLINKER.LSF",
    "area_id": "K.2",
    "material": "clinker",
    "name": "LSF",
    "unit": "-",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 80,
    "valid_max": 120,
    "samples_per_day": null,
    "qcx_column": "CK2_LSF",
    "sort_order": 29,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "K.2.CLINKER.SO3",
    "area_id": "K.2",
    "material": "clinker",
    "name": "SO3",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 10,
    "samples_per_day": null,
    "qcx_column": "CK2_SO3",
    "sort_order": 30,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "K.2.CLINKER.FL",
    "area_id": "K.2",
    "material": "clinker",
    "name": "Free lime",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 6,
    "samples_per_day": null,
    "qcx_column": "CK2_FL",
    "sort_order": 31,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "K.2.CLINKER.C3S",
    "area_id": "K.2",
    "material": "clinker",
    "name": "C3S",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 30,
    "valid_max": 80,
    "samples_per_day": null,
    "qcx_column": "CK2_C3S",
    "sort_order": 32,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "K.2.CLINKER.C2S",
    "area_id": "K.2",
    "material": "clinker",
    "name": "C2S",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 40,
    "samples_per_day": null,
    "qcx_column": "CK2_C2S",
    "sort_order": 33,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "K.2.HOT_MEAL.SO3",
    "area_id": "K.2",
    "material": "hot_meal",
    "name": "SO3",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 10,
    "samples_per_day": null,
    "qcx_column": "HM2_SO3",
    "sort_order": 34,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "K.2.HOT_MEAL.CL",
    "area_id": "K.2",
    "material": "hot_meal",
    "name": "Cl",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 3,
    "samples_per_day": null,
    "qcx_column": "HM2_CL",
    "sort_order": 35,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "K.2.HOT_MEAL.VOLATILITY",
    "area_id": "K.2",
    "material": "hot_meal",
    "name": "SO3 volatility",
    "unit": "-",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 1,
    "samples_per_day": null,
    "qcx_column": "HM2_Volatility",
    "sort_order": 36,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "FM.1.COAL.SIEVE",
    "area_id": "FM.1",
    "material": "coal",
    "name": "Sieve residue",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 40,
    "samples_per_day": null,
    "qcx_column": "COAL1_Sieve",
    "sort_order": 37,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "FM.1.PETCOKE.SIEVE",
    "area_id": "FM.1",
    "material": "petcoke",
    "name": "Sieve residue",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 40,
    "samples_per_day": null,
    "qcx_column": "PETCOKE1_Sieve",
    "sort_order": 38,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "FM.2.COAL.SIEVE",
    "area_id": "FM.2",
    "material": "coal",
    "name": "Sieve residue",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 40,
    "samples_per_day": null,
    "qcx_column": "COAL2_Sieve",
    "sort_order": 39,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "FM.2.PETCOKE.SIEVE",
    "area_id": "FM.2",
    "material": "petcoke",
    "name": "Sieve residue",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 40,
    "samples_per_day": null,
    "qcx_column": "PETCOKE2_Sieve",
    "sort_order": 40,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "CM.1.CEMENT.SIEVE",
    "area_id": "CM.1",
    "material": "cement",
    "name": "Sieve residue",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 40,
    "samples_per_day": null,
    "qcx_column": "CM1_Sieve",
    "sort_order": 41,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "CM.1.CEMENT.SO3",
    "area_id": "CM.1",
    "material": "cement",
    "name": "SO3",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 10,
    "samples_per_day": null,
    "qcx_column": "CM1_SO3",
    "sort_order": 42,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "CM.1.CEMENT.BLAINE",
    "area_id": "CM.1",
    "material": "cement",
    "name": "Blaine",
    "unit": "cm²/g",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 2000,
    "valid_max": 6000,
    "samples_per_day": null,
    "qcx_column": "CM1_Blaine",
    "sort_order": 43,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "CM.2.CEMENT.SIEVE",
    "area_id": "CM.2",
    "material": "cement",
    "name": "Sieve residue",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 40,
    "samples_per_day": null,
    "qcx_column": "CM2_Sieve",
    "sort_order": 44,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "CM.2.CEMENT.SO3",
    "area_id": "CM.2",
    "material": "cement",
    "name": "SO3",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 10,
    "samples_per_day": null,
    "qcx_column": "CM2_SO3",
    "sort_order": 45,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "CM.2.CEMENT.BLAINE",
    "area_id": "CM.2",
    "material": "cement",
    "name": "Blaine",
    "unit": "cm²/g",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 2000,
    "valid_max": 6000,
    "samples_per_day": null,
    "qcx_column": "CM2_Blaine",
    "sort_order": 46,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "CM.3.CEMENT.SIEVE",
    "area_id": "CM.3",
    "material": "cement",
    "name": "Sieve residue",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 40,
    "samples_per_day": null,
    "qcx_column": "CM3_Sieve",
    "sort_order": 47,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "CM.3.CEMENT.SO3",
    "area_id": "CM.3",
    "material": "cement",
    "name": "SO3",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 10,
    "samples_per_day": null,
    "qcx_column": "CM3_SO3",
    "sort_order": 48,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "CM.3.CEMENT.BLAINE",
    "area_id": "CM.3",
    "material": "cement",
    "name": "Blaine",
    "unit": "cm²/g",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 2000,
    "valid_max": 6000,
    "samples_per_day": null,
    "qcx_column": "CM3_Blaine",
    "sort_order": 49,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "CM.4.CEMENT.SIEVE",
    "area_id": "CM.4",
    "material": "cement",
    "name": "Sieve residue",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 40,
    "samples_per_day": null,
    "qcx_column": "CM4_Sieve",
    "sort_order": 50,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "CM.4.CEMENT.SO3",
    "area_id": "CM.4",
    "material": "cement",
    "name": "SO3",
    "unit": "%",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 0,
    "valid_max": 10,
    "samples_per_day": null,
    "qcx_column": "CM4_SO3",
    "sort_order": 51,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   },
   {
    "param_id": "CM.4.CEMENT.BLAINE",
    "area_id": "CM.4",
    "material": "cement",
    "name": "Blaine",
    "unit": "cm²/g",
    "spec_min": null,
    "spec_max": null,
    "target": null,
    "valid_min": 2000,
    "valid_max": 6000,
    "samples_per_day": null,
    "qcx_column": "CM4_Blaine",
    "sort_order": 52,
    "active": true,
    "notes": "Specification limits to be entered by the quality department; valid range is a starting value to confirm"
   }
  ],
  "checkRules": [
   {
    "rule_id": "DT-ORDER",
    "section": "downtime",
    "check_type": "order",
    "name": "Restart before stop",
    "description": "The restart time is before the stop time",
    "applies_to": "all",
    "threshold": null,
    "threshold_unit": "",
    "severity": "block",
    "owner_duty": "shift_entry",
    "active": true
   },
   {
    "rule_id": "DT-CLASS",
    "section": "downtime",
    "check_type": "missing",
    "name": "No classification",
    "description": "PRO, MEC, ELE, AUT, PL or CIR is missing",
    "applies_to": "all",
    "threshold": null,
    "threshold_unit": "",
    "severity": "block",
    "owner_duty": "shift_entry",
    "active": true
   },
   {
    "rule_id": "DT-CODE",
    "section": "downtime",
    "check_type": "missing",
    "name": "Unknown equipment code",
    "description": "The code is not in the equipment master of the area",
    "applies_to": "all",
    "threshold": null,
    "threshold_unit": "",
    "severity": "warn",
    "owner_duty": "reliability_validation",
    "active": true
   },
   {
    "rule_id": "DT-REASON",
    "section": "downtime",
    "check_type": "missing",
    "name": "No reason",
    "description": "The reason is blank or not in the reason list",
    "applies_to": "all",
    "threshold": null,
    "threshold_unit": "",
    "severity": "warn",
    "owner_duty": "reliability_validation",
    "active": true
   },
   {
    "rule_id": "DT-OVERLAP",
    "section": "downtime",
    "check_type": "order",
    "name": "Overlapping stops",
    "description": "Two stops of one area overlap; the hours are counted once",
    "applies_to": "all",
    "threshold": null,
    "threshold_unit": "",
    "severity": "info",
    "owner_duty": "reliability_validation",
    "active": true
   },
   {
    "rule_id": "DT-OPEN",
    "section": "downtime",
    "check_type": "change",
    "name": "Long open stop",
    "description": "A stop is still open after this many hours; the current shift confirms it is still stopped",
    "applies_to": "all",
    "threshold": 24,
    "threshold_unit": "h",
    "severity": "warn",
    "owner_duty": "shift_entry",
    "active": true
   },
   {
    "rule_id": "DT-DUP",
    "section": "downtime",
    "check_type": "duplicate",
    "name": "Same stop twice",
    "description": "Same area, equipment and stop time entered twice",
    "applies_to": "all",
    "threshold": null,
    "threshold_unit": "",
    "severity": "block",
    "owner_duty": "shift_entry",
    "active": true
   },
   {
    "rule_id": "PR-MISSING",
    "section": "production",
    "check_type": "missing",
    "name": "Value missing",
    "description": "A required production value is missing for the day",
    "applies_to": "all",
    "threshold": null,
    "threshold_unit": "",
    "severity": "warn",
    "owner_duty": "production_data",
    "active": true
   },
   {
    "rule_id": "PR-NEG",
    "section": "production",
    "check_type": "range",
    "name": "Negative value",
    "description": "Production, running hours, power, fuel and water cannot be negative",
    "applies_to": "all",
    "threshold": 0,
    "threshold_unit": "",
    "severity": "block",
    "owner_duty": "production_data",
    "active": true
   },
   {
    "rule_id": "PR-RANGE",
    "section": "production",
    "check_type": "range",
    "name": "Outside the limits",
    "description": "The value is outside the min / max of the metric (production_metrics)",
    "applies_to": "all",
    "threshold": null,
    "threshold_unit": "",
    "severity": "warn",
    "owner_duty": "production_data",
    "active": true
   },
   {
    "rule_id": "PR-RH24",
    "section": "production",
    "check_type": "range",
    "name": "Running hours above the day",
    "description": "Running hours of an area above 24 h in a day",
    "applies_to": "all",
    "threshold": 24,
    "threshold_unit": "h",
    "severity": "block",
    "owner_duty": "production_data",
    "active": true
   },
   {
    "rule_id": "PR-NORH",
    "section": "production",
    "check_type": "reconcile",
    "name": "Production without running",
    "description": "Production above 0 while the running hours are 0, or the opposite",
    "applies_to": "all",
    "threshold": null,
    "threshold_unit": "",
    "severity": "warn",
    "owner_duty": "production_data",
    "active": true
   },
   {
    "rule_id": "PR-RATE",
    "section": "production",
    "check_type": "range",
    "name": "Rate far from target",
    "description": "Production rate differs from the target rate by more than this",
    "applies_to": "all",
    "threshold": 25,
    "threshold_unit": "%",
    "severity": "warn",
    "owner_duty": "production_review",
    "active": true
   },
   {
    "rule_id": "PR-JUMP",
    "section": "production",
    "check_type": "change",
    "name": "Sudden change",
    "description": "The value changed by more than this against the day before",
    "applies_to": "all",
    "threshold": 50,
    "threshold_unit": "%",
    "severity": "info",
    "owner_duty": "production_data",
    "active": true
   },
   {
    "rule_id": "PR-CORR",
    "section": "production",
    "check_type": "change",
    "name": "Large correction",
    "description": "A correction above this share of the raw value needs a reason and the production manager's approval",
    "applies_to": "all",
    "threshold": 5,
    "threshold_unit": "%",
    "severity": "warn",
    "owner_duty": "production_review",
    "active": true
   },
   {
    "rule_id": "EN-SPC",
    "section": "energy",
    "check_type": "range",
    "name": "SPC above the limit",
    "description": "Specific power above the metric limit: flagged for review, never set to 0",
    "applies_to": "all",
    "threshold": null,
    "threshold_unit": "",
    "severity": "warn",
    "owner_duty": "production_data",
    "active": true
   },
   {
    "rule_id": "EN-NOPROD",
    "section": "energy",
    "check_type": "reconcile",
    "name": "Power without production",
    "description": "Process power used while production is 0 (standby losses)",
    "applies_to": "all",
    "threshold": null,
    "threshold_unit": "",
    "severity": "info",
    "owner_duty": "production_data",
    "active": true
   },
   {
    "rule_id": "EN-METER",
    "section": "energy",
    "check_type": "balance",
    "name": "Meters do not add up",
    "description": "Sum of the area meters differs from the transformer meters by more than this",
    "applies_to": "all",
    "threshold": 5,
    "threshold_unit": "%",
    "severity": "warn",
    "owner_duty": "production_data",
    "active": true
   },
   {
    "rule_id": "FU-SHC",
    "section": "fuel",
    "check_type": "range",
    "name": "SHC above the limit",
    "description": "Specific heat above the limit: flagged, never set to 0",
    "applies_to": "K.1,K.2",
    "threshold": 1500,
    "threshold_unit": "kcal/kg",
    "severity": "warn",
    "owner_duty": "production_data",
    "active": true
   },
   {
    "rule_id": "FU-CV",
    "section": "fuel",
    "check_type": "missing",
    "name": "No calorific value",
    "description": "A fuel was used on a day that has no calorific value",
    "applies_to": "K.1,K.2",
    "threshold": null,
    "threshold_unit": "",
    "severity": "block",
    "owner_duty": "production_data",
    "active": true
   },
   {
    "rule_id": "FU-TSR",
    "section": "fuel",
    "check_type": "range",
    "name": "TSR outside 0-100 %",
    "description": "Thermal substitution rate below 0 or above 100 %",
    "applies_to": "K.1,K.2",
    "threshold": null,
    "threshold_unit": "",
    "severity": "block",
    "owner_duty": "production_data",
    "active": true
   },
   {
    "rule_id": "WA-SWC",
    "section": "water",
    "check_type": "range",
    "name": "SWC above the limit",
    "description": "Specific water above the limit: flagged, never set to 0",
    "applies_to": "all",
    "threshold": 500,
    "threshold_unit": "l/t",
    "severity": "warn",
    "owner_duty": "production_data",
    "active": true
   },
   {
    "rule_id": "ST-LEVEL",
    "section": "stock",
    "check_type": "range",
    "name": "Level outside 0-100 %",
    "description": "A silo or tank level below 0 or above 100 %",
    "applies_to": "all",
    "threshold": null,
    "threshold_unit": "",
    "severity": "block",
    "owner_duty": "production_data",
    "active": true
   },
   {
    "rule_id": "ST-JUMP",
    "section": "stock",
    "check_type": "change",
    "name": "Level jump",
    "description": "A level changed by more than this in a day without matching production or use",
    "applies_to": "all",
    "threshold": 30,
    "threshold_unit": "points",
    "severity": "warn",
    "owner_duty": "production_data",
    "active": true
   },
   {
    "rule_id": "ST-BAL",
    "section": "stock",
    "check_type": "balance",
    "name": "Stock does not balance",
    "description": "Opening + in − out differs from closing stock by more than this",
    "applies_to": "all",
    "threshold": 5,
    "threshold_unit": "%",
    "severity": "warn",
    "owner_duty": "production_review",
    "active": true
   },
   {
    "rule_id": "MA-CLK",
    "section": "materials",
    "check_type": "balance",
    "name": "Clinker balance gap",
    "description": "Clinker produced − used by the mills − change in stock, above this share of production",
    "applies_to": "K.1,K.2,CM.1,CM.2,CM.3,CM.4",
    "threshold": 3,
    "threshold_unit": "%",
    "severity": "warn",
    "owner_duty": "production_review",
    "active": true
   },
   {
    "rule_id": "MA-MIX",
    "section": "materials",
    "check_type": "balance",
    "name": "Mix does not add up",
    "description": "Raw mix or cement recipe shares do not add up to 100 %",
    "applies_to": "RM.1,RM.2,CM.1,CM.2,CM.3,CM.4",
    "threshold": 0.5,
    "threshold_unit": "%",
    "severity": "block",
    "owner_duty": "production_data",
    "active": true
   },
   {
    "rule_id": "MA-CF",
    "section": "materials",
    "check_type": "range",
    "name": "Clinker factor out of range",
    "description": "The clinker factor used for the day is outside this range (1.50 - 1.75)",
    "applies_to": "K.1,K.2",
    "threshold": null,
    "threshold_unit": "",
    "severity": "warn",
    "owner_duty": "production_review",
    "active": true
   },
   {
    "rule_id": "QU-VALID",
    "section": "quality",
    "check_type": "range",
    "name": "Impossible result",
    "description": "Result outside the valid range of the parameter: most likely a typing or analyser error",
    "applies_to": "all",
    "threshold": null,
    "threshold_unit": "",
    "severity": "block",
    "owner_duty": "quality_validation",
    "active": true
   },
   {
    "rule_id": "QU-SPEC",
    "section": "quality",
    "check_type": "spec",
    "name": "Out of specification",
    "description": "Result outside the specification limits; counted in the in-spec KPIs and shown in the daily meeting",
    "applies_to": "all",
    "threshold": null,
    "threshold_unit": "",
    "severity": "warn",
    "owner_duty": "quality_validation",
    "active": true
   },
   {
    "rule_id": "QU-COUNT",
    "section": "quality",
    "check_type": "count",
    "name": "Too few samples",
    "description": "Fewer results than samples_per_day while the area was running",
    "applies_to": "all",
    "threshold": null,
    "threshold_unit": "",
    "severity": "warn",
    "owner_duty": "quality_validation",
    "active": true
   },
   {
    "rule_id": "QU-STUCK",
    "section": "quality",
    "check_type": "change",
    "name": "Same value repeated",
    "description": "The same value this many times in a row: analyser or copy error",
    "applies_to": "all",
    "threshold": 4,
    "threshold_unit": "results",
    "severity": "info",
    "owner_duty": "quality_validation",
    "active": true
   },
   {
    "rule_id": "QU-STOPPED",
    "section": "quality",
    "check_type": "reconcile",
    "name": "Results while stopped",
    "description": "Results recorded for an area that was stopped the whole day",
    "applies_to": "all",
    "threshold": null,
    "threshold_unit": "",
    "severity": "info",
    "owner_duty": "quality_validation",
    "active": true
   },
   {
    "rule_id": "XS-RH",
    "section": "cross",
    "check_type": "reconcile",
    "name": "Running hours disagree",
    "description": "DCS running hours differ from scheduled minus stoppage hours by more than this",
    "applies_to": "all",
    "threshold": 1,
    "threshold_unit": "h/day",
    "severity": "warn",
    "owner_duty": "reliability_validation",
    "active": true
   },
   {
    "rule_id": "XS-STOPPROD",
    "section": "cross",
    "check_type": "reconcile",
    "name": "Production during a stop",
    "description": "Production recorded while the stoppage log shows the area stopped the whole day",
    "applies_to": "all",
    "threshold": null,
    "threshold_unit": "",
    "severity": "warn",
    "owner_duty": "production_review",
    "active": true
   },
   {
    "rule_id": "XS-LATE",
    "section": "cross",
    "check_type": "missing",
    "name": "Report late",
    "description": "A shift report, production value or lab result is past its deadline",
    "applies_to": "all",
    "threshold": null,
    "threshold_unit": "",
    "severity": "info",
    "owner_duty": "daily_meeting",
    "active": true
   }
  ]
 }
};
