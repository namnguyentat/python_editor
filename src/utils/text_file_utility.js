const import_file = (f, cb) => {
  let fr = new FileReader();
  fr.onload = () => {
    let data;
    try {
      data = fr.result;
    } catch (e) {
      return cb(e);
    }
    return cb(null, data);
  };
  fr.readAsText(f);
};

const export_file = (obj, filename) => {
  let data = 'data:application/text;charset=utf-8,' + obj;
  let link = document.createElement('a');
  link.setAttribute('href', encodeURI(data));
  link.setAttribute('download', filename);
  link.click();
};

module.exports = {
  import: import_file,
  export: export_file
};
