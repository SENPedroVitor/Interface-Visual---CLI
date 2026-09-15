from pathlib import Path
import unittest


MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "supabase"
    / "migrations"
    / "20260915000100_initial_waddle_schema.sql"
)


class SupabaseMigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql = MIGRATION.read_text(encoding="utf-8")

    def test_workspace_boundary_and_bootstrap_helpers_exist(self):
        self.assertIn("create or replace function public.is_workspace_member", self.sql)
        self.assertIn("create or replace function public.is_workspace_creator", self.sql)
        self.assertIn("create or replace function public.prevent_workspace_owner_change", self.sql)
        self.assertIn("workspace_owner_immutable", self.sql)
        self.assertIn("create policy workspace_members_admin_insert", self.sql)
        self.assertIn("public.is_workspace_admin(workspace_id)", self.sql)

    def test_cross_workspace_relationships_use_composite_foreign_keys(self):
        self.assertIn("foreign key (workspace_id, run_id)", self.sql)
        self.assertIn("foreign key (workspace_id, assigned_agent)", self.sql)
        self.assertIn("foreign key (workspace_id, task_id)", self.sql)
        self.assertIn("foreign key (workspace_id, group_id)", self.sql)

    def test_client_tables_enable_rls_and_realtime(self):
        self.assertIn("alter table public.%I enable row level security", self.sql)
        self.assertIn("alter publication supabase_realtime add table public.events", self.sql)
        self.assertIn("alter publication supabase_realtime add table public.messages", self.sql)


if __name__ == "__main__":
    unittest.main()
