import './App.css';
import 'bootstrap/dist/css/bootstrap.css';
import 'antd/dist/antd.less';

import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import { remote } from 'electron';

import SplitPane, { Pane } from 'react-split-pane';
import { JSONEditor } from '@json-editor/json-editor';
import { Table, message, Button } from 'antd';
import BSTable from './BSTable';
import { Resizable } from 'react-resizable';

import toJsonSchema from 'to-json-schema';
import fs from 'fs';
import path from 'path';

const ResizeableTitle = props => {
  const { onResize, width, ...restProps } = props;

  if (!width) {
    return <th {...restProps} />;
  }

  return (
    <Resizable
      width={width}
      height={0}
      handle={resizeHandle =>
        <span
          className={`react-resizable-handle react-resizable-handle-${resizeHandle}`}
          onClick={e => { e.stopPropagation(); }}
        />
      }
      onResize={onResize}
      handleSize={[10, 10]}
      draggableOpts={{ enableUserSelectHack: false }
      }
    >
      <th {...restProps} />
    </Resizable >
  );
};

class App extends Component {

  constructor(props) {
    super(props);
    this.editor_holder = React.createRef();
    this.editor = undefined
    this.state = {
      selectedRow: {}
    }
  }

  componentDidMount() {
    document.addEventListener("keydown", this.onKeyPress.bind(this), false);
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.onKeyPress.bind(this), false);
  }

  loadDatas(data) {
    let columns = []
    if (Array.isArray(data)) {
      let allKeys = [], nestedKeys = [], flatKeys = []
      for (const obj of data) {
        if (typeof obj === "object" && !Array.isArray(obj)) {
          const keys = Object.keys(obj);
          for (const key of keys) {
            if (!allKeys.includes(key)) {
              allKeys.push(key);
            }
            if (typeof obj[key] === "object" && !nestedKeys.includes(key)) {
              nestedKeys.push(key)
            }
          }
        }
      }
      for (const key of allKeys) {
        if (!nestedKeys.includes(key)) {
          columns.push({
            key: key,
            dataIndex: key,
            title: key.charAt(0).toUpperCase() + key.slice(1),
            sorter: (a, b) => a[key].length - b[key].length,
            width: 200,
            ellipsis: true
          });
          flatKeys.push(key);
        }
      }
      data = data.map((el, i) => Object.assign(el, { key: i }));
      message.success("Json importé!")
      this.setState({ columns: columns, data: data });
    } else {
      message.error("Le fichier importé doit être un tableau d'objets JSON")
    }
  }

  onKeyPress(event) {
    if (event.keyCode === 46) {
      const data = this.state.data.filter(el => !(el.id === this.selectedRow.id));
      this.setState({ data: data, selectedRow: {} });
    }
  }

  saveJsonDoc() {
    const { data } = this.state;
    const jsonDoc = this.editor.getValue();
    for (let row of data) {
      if (row.id === jsonDoc.id) {
        row = Object.assign(row, jsonDoc);
        break;
      }
    }
    this.setState({ data: data });
  }

  onRowEdit(row, index) {
    this.setState({ selectedRow: row })
    if (!this.editor) {
      this.editor = new JSONEditor(this.editor_holder.current, {
        theme: 'bootstrap4',
        iconlib: "fontawesome5",
        schema: Object.assign({ title: "Document" }, toJsonSchema(row, {
          arrays: {
            mode: 'first'
          },
          strings: {
            detectFormat: true
          }
        }))
      })
    }
    this.editor.setValue(row);
  }

  importJson() {
    const options = { properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] }
    remote.dialog.showOpenDialog(options).then(result => {
      if (!result.canceled) {
        const json = fs.readFileSync(result.filePaths[0], 'utf8').toString();
        this.loadDatas(JSON.parse(json))
      }
    }).catch(err => {
      console.log(err)
    })
  }

  importJsonBib() {
    console.log("importjsonbib")
  }

  exportJson() {
    const options = { properties: ['createDirectory'], filters: [{ name: 'JSON', extensions: ['json'] }] }
    remote.dialog.showOpenDialog(options).then(result => {
      if (!result.canceled) {
        const json = fs.readFileSync(result.filePaths[0], 'utf8').toString();
        this.loadDatas(JSON.parse(json))
      }
    }).catch(err => {
      console.log(err)
    })
  }

  exportJsonBib() {
    const options = { properties: ['openDirectory'], filters: [{ name: 'All Files', extensions: ['*'] }] }
    remote.dialog.showOpenDialog(options).then(result => {
      if (!result.canceled) {
        const jsonBibPath = result.filePaths[0];
        fs.rmdirSync(jsonBibPath, { recursive: true });
        fs.mkdirSync(jsonBibPath);
        const jsonBibFilesPath = jsonBibPath + "\\files";
        const jsonBibMetadataPath = jsonBibPath + "\\metadata.json";
        fs.mkdirSync(jsonBibFilesPath);
        const { data } = this.state;
        for (const row of data) {
          const { attachment } = row;
          if (attachment) {
            const jsonBibFilesFolderPath = jsonBibFilesPath + "\\" + row.key;
            fs.mkdirSync(jsonBibFilesFolderPath);
            for (const a of attachment) {
              const jsonBibFilePath = jsonBibFilesFolderPath + "\\" + path.basename(a.path);
              if (fs.existsSync(a.path)) {
                fs.copyFileSync(a.path, jsonBibFilePath);
              }
              a.path = path.relative(jsonBibPath, jsonBibFilePath);
            }
          }
        }
        fs.writeFileSync(jsonBibMetadataPath, JSON.stringify(data, null, 4), 'utf8');
        message.success("Bibliothèque JSON (metadonnées + documents) exportée avec succès!")
      }
    }).catch(err => {
      console.log(err)
    })
  }

  handleResize(index) {
    (e, { size }) => {
      this.setState(({ columns }) => {
        const nextColumns = [...columns];
        nextColumns[index] = {
          ...nextColumns[index],
          width: size.width,
        };
        return { columns: nextColumns };
      });
    }
  };

  render() {

    const { data, selectedRow } = this.state;
    const nonExpandable = data ? data.filter(el => !el.attachment || el.attachment.length === 0).map(el => el.id) : [];

    let { columns } = this.state;
    if (columns) {
      columns = columns.map((col, index) => ({
        ...col,
        onHeaderCell: column => ({
          width: column.width,
          onResize: this.handleResize(index),
        }),
      }));
    }

    return (
      <React.Fragment>
        <div >
          <Button className="menu btn-sm" onClick={() => this.importJson()} >Import JSON (meta)</Button>
          <Button className="menu btn-sm" onClick={() => this.importJsonBib()} >Import JSON BIB (meta + files)</Button>
          {data ? <Button className="menu btn-sm" onClick={() => this.saveJson()} > Save</Button> : <div />}
          {data ? <Button className="menu btn-sm" onClick={() => this.exportJson()} >Export JSON (meta)</Button> : <div />}
          {data ? <Button className="menu btn-sm" onClick={() => this.exportJsonBib()} >Export JSON BIB (meta + files)</Button> : <div />}
        </div>
        <SplitPane split="vertical" primary="first" minSize={300} defaultSize={'75%'} maxSize={-400}>
          <Pane className="pane1"  >
            {data ?
              <Table
                dataSource={data}
                columns={columns}
                pagination={false}
                components={{ header: { cell: ResizeableTitle } }}
                rowExpandable={(row) => !nonExpandable.includes(row.id)}
                onRow={(row) => ({
                  onClick: () => { this.onRowEdit(row) }
                })}
                rowSelection={{ selectedRowKeys: [selectedRow.key] }}
                size="small"
                expandedRowRender={(row) => { return (<BSTable row={row} />) }}
              />
              : <div />}
          </Pane>
          <Pane className="pane2" style={{ 'height': '100%' }}>
            {data ?
              <div>
                <Button className="save btn-sm" onClick={() => this.saveJsonDoc()} >Save</Button>
                <div ref={this.editor_holder} />
              </div>
              : <div />}
          </Pane>
        </SplitPane>
      </React.Fragment >
    )
  }
}


export default App
