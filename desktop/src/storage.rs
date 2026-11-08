//! The notes file. Every save goes to a temp file first and the previous file is kept as
//! `.bak`, so a crash mid-save or a damaged file never costs more than the last change.
//! A damaged file is renamed aside, never deleted or overwritten.

use serde_json::{Map, Value};
use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const MAIN: &str = "notelet.json";
const BACKUP: &str = "notelet.json.bak";
const TEMP: &str = "notelet.json.tmp";

pub struct Loaded {
    pub data: Map<String, Value>,
    /// `Some("backup")` when the `.bak` copy was opened, `Some("reset")` when nothing readable was left.
    pub recovered: Option<&'static str>,
    pub damaged_path: Option<PathBuf>,
}

enum Read {
    Missing,
    Damaged,
    Good(Map<String, Value>),
}

pub fn save(dir: &Path, data: &Map<String, Value>) -> io::Result<()> {
    fs::create_dir_all(dir)?;
    let temp = dir.join(TEMP);
    let mut file = fs::File::create(&temp)?;
    file.write_all(&serde_json::to_vec(data)?)?;
    file.sync_all()?;
    drop(file);
    let main = dir.join(MAIN);
    if main.exists() {
        fs::rename(&main, dir.join(BACKUP))?;
    }
    fs::rename(&temp, &main)
}

pub fn load(dir: &Path) -> io::Result<Loaded> {
    let main = dir.join(MAIN);
    let backup = dir.join(BACKUP);
    let main_read = read(&main)?;
    if let Read::Good(data) = main_read {
        return Ok(Loaded { data, recovered: None, damaged_path: None });
    }
    let backup_read = read(&backup)?;
    let main_damaged = matches!(main_read, Read::Damaged);
    match backup_read {
        Read::Missing if !main_damaged => Ok(Loaded { data: Map::new(), recovered: None, damaged_path: None }),
        Read::Good(data) => {
            if main_damaged {
                move_aside(&main)?;
            }
            Ok(Loaded { data, recovered: Some("backup"), damaged_path: None })
        }
        _ => {
            let moved_main = if main_damaged { Some(move_aside(&main)?) } else { None };
            let moved_backup = if matches!(backup_read, Read::Damaged) { Some(move_aside(&backup)?) } else { None };
            Ok(Loaded { data: Map::new(), recovered: Some("reset"), damaged_path: moved_main.or(moved_backup) })
        }
    }
}

fn read(path: &Path) -> io::Result<Read> {
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(Read::Missing),
        Err(error) => return Err(error),
    };
    Ok(match serde_json::from_slice::<Value>(&bytes) {
        Ok(Value::Object(map)) => Read::Good(map),
        _ => Read::Damaged,
    })
}

fn move_aside(path: &Path) -> io::Result<PathBuf> {
    let millis = SystemTime::now().duration_since(UNIX_EPOCH).map(|elapsed| elapsed.as_millis()).unwrap_or(0);
    let mut name = path.file_name().unwrap_or_default().to_os_string();
    name.push(format!(".damaged-{millis}"));
    let target = path.with_file_name(name);
    fs::rename(path, &target)?;
    Ok(target)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn map(value: Value) -> Map<String, Value> {
        value.as_object().unwrap().clone()
    }

    fn damaged_files(dir: &Path, prefix: &str) -> Vec<PathBuf> {
        fs::read_dir(dir)
            .unwrap()
            .map(|entry| entry.unwrap().path())
            .filter(|path| path.file_name().unwrap().to_string_lossy().starts_with(&format!("{prefix}.damaged-")))
            .collect()
    }

    #[test]
    fn save_then_load_round_trips() {
        let dir = tempfile::tempdir().unwrap();
        let data = map(json!({ "note:a": { "html": "<p>é</p>" }, "schemaVersion": 5 }));
        save(dir.path(), &data).unwrap();
        let loaded = load(dir.path()).unwrap();
        assert_eq!(loaded.data, data);
        assert_eq!(loaded.recovered, None);
    }

    #[test]
    fn second_save_keeps_previous_as_bak() {
        let dir = tempfile::tempdir().unwrap();
        save(dir.path(), &map(json!({ "v": 1 }))).unwrap();
        save(dir.path(), &map(json!({ "v": 2 }))).unwrap();
        let bak: Value = serde_json::from_slice(&fs::read(dir.path().join(BACKUP)).unwrap()).unwrap();
        assert_eq!(bak, json!({ "v": 1 }));
        assert_eq!(load(dir.path()).unwrap().data, map(json!({ "v": 2 })));
    }

    #[test]
    fn no_tmp_file_left_after_save() {
        let dir = tempfile::tempdir().unwrap();
        save(dir.path(), &map(json!({ "v": 1 }))).unwrap();
        assert!(!dir.path().join(TEMP).exists());
    }

    #[test]
    fn fresh_dir_loads_empty_without_recovery() {
        let dir = tempfile::tempdir().unwrap();
        let loaded = load(&dir.path().join("not-created-yet")).unwrap();
        assert!(loaded.data.is_empty());
        assert_eq!(loaded.recovered, None);
        assert_eq!(loaded.damaged_path, None);
    }

    #[test]
    fn load_uses_bak_when_main_missing() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join(BACKUP), br#"{"v":1}"#).unwrap();
        let loaded = load(dir.path()).unwrap();
        assert_eq!(loaded.data, map(json!({ "v": 1 })));
        assert_eq!(loaded.recovered, Some("backup"));
    }

    #[test]
    fn load_uses_bak_when_main_damaged_and_moves_main_aside() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join(MAIN), b"{not json").unwrap();
        fs::write(dir.path().join(BACKUP), br#"{"v":1}"#).unwrap();
        let loaded = load(dir.path()).unwrap();
        assert_eq!(loaded.data, map(json!({ "v": 1 })));
        assert_eq!(loaded.recovered, Some("backup"));
        let moved = damaged_files(dir.path(), MAIN);
        assert_eq!(moved.len(), 1);
        assert_eq!(fs::read(&moved[0]).unwrap(), b"{not json");
        assert!(!dir.path().join(MAIN).exists());
    }

    #[test]
    fn both_damaged_moves_both_aside_and_starts_empty() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join(MAIN), b"[1,2]").unwrap();
        fs::write(dir.path().join(BACKUP), b"garbage").unwrap();
        let loaded = load(dir.path()).unwrap();
        assert!(loaded.data.is_empty());
        assert_eq!(loaded.recovered, Some("reset"));
        let main_moved = damaged_files(dir.path(), MAIN);
        let backup_moved = damaged_files(dir.path(), BACKUP);
        assert_eq!(fs::read(&main_moved[0]).unwrap(), b"[1,2]");
        assert_eq!(fs::read(&backup_moved[0]).unwrap(), b"garbage");
        assert_eq!(loaded.damaged_path.as_ref(), Some(&main_moved[0]));
    }

    #[test]
    fn main_damaged_and_no_bak_resets() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join(MAIN), b"").unwrap();
        let loaded = load(dir.path()).unwrap();
        assert!(loaded.data.is_empty());
        assert_eq!(loaded.recovered, Some("reset"));
        assert_eq!(fs::read(loaded.damaged_path.unwrap()).unwrap(), b"");
    }
}
