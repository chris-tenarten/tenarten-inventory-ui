# Current packaging entry point. Initial validator is preserved in revisions/01-initial.
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).resolve().with_name('validate-refinement.py')),run_name='__main__')
