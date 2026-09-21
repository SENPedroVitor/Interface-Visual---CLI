import subprocess
import unittest
from pathlib import Path


class FauxNeuralSubmoduleCheckTests(unittest.TestCase):
    def test_check_script_reports_clean_pinned_submodule(self):
        repo_root = Path(__file__).resolve().parents[1]
        result = subprocess.run(
            ["bash", "scripts/check_faux_neural.sh"],
            cwd=repo_root,
            check=False,
            text=True,
            capture_output=True,
        )

        output = result.stdout + result.stderr
        self.assertEqual(result.returncode, 0, output)
        self.assertIn("Faux-Neural submodule check passed", output)
        self.assertIn("528ce9f703b5f9da749737be3f7be05345cbb983", output)


if __name__ == "__main__":
    unittest.main()
