import './App.css';
import 'bootstrap/dist/css/bootstrap.css';
import 'antd/dist/antd.less';

import React, { Component } from 'react';
import { remote } from 'electron';

import SplitPane, { Pane } from 'react-split-pane';
import { JSONEditor } from '@json-editor/json-editor';
import { DndProvider } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';
import { Table, message, Button, Tag, Divider, Tooltip } from 'antd';
import BSTable from './BSTable';
import { Resizable } from 'react-resizable';

import toJsonSchema from 'to-json-schema';
import fs from 'fs';
import path from 'path';
import bibtexParse from 'bibtex-parse';

// const ResizeableTitle = props => {
//   const { onResize, width, ...restProps } = props;

//   if (!width) {
//     return <th {...restProps} />;
//   }

//   return (
//     <Resizable
//       width={width}
//       height={0}
//       handle={resizeHandle =>
//         <span
//           className={`react-resizable-handle react-resizable-handle-${resizeHandle}`}
//           onClick={e => { e.stopPropagation(); }}
//         />
//       }
//       onResize={onResize}
//       handleSize={[10, 10]}
//       draggableOpts={{ enableUserSelectHack: false }
//       }
//     >
//       <th {...restProps} />
//     </Resizable >
//   );
// };

class App extends Component {

  constructor(props) {
    super(props);
    this.editor = undefined
    this.state = {
      selectedRow: {},
      selectedIndex: undefined
    }
  }

  componentDidMount() {
    document.addEventListener("keydown", this.onKeyPress.bind(this), false);
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.onKeyPress.bind(this), false);
  }

  loadDatas(data, path) {
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
              nestedKeys.push(key);
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
            sorter: (a, b) => {
              if (a[key] && b[key]) {
                return a[key].localeCompare(b[key]);
              } else {
                return a[key] ? -1 : 1;
              }
            },
            width: 200,
            ellipsis: true
          });
          flatKeys.push(key);
        }
      }
      data = data.map((el, i) => Object.assign(el, { key: i }));
      message.success("Json importé!")
      this.setState({ columns: columns, data: data, path: path });
    } else {
      message.error("Le fichier importé doit être un tableau d'objets JSON")
    }
  }

  onKeyPress(event) {
    if (event.keyCode === 46) {
      const data = [...this.state.data];
      data.splice(this.state.selectedIndex, 1);
      this.setState({ data, selectedRow: {}, selectedIndex: undefined });
    }
  }

  saveJsonDoc() {
    const { data, selectedIndex } = this.state;
    const jsonDoc = this.editor.getValue();
    data[selectedIndex] = Object.assign(data[selectedIndex], jsonDoc);
    this.setState({ data });
  }

  onRowEdit(row, rowIndex) {
    this.setState({ selectedRow: row, selectedIndex: rowIndex });
    if (!this.editor) {
      this.editor = new JSONEditor(this.refs["editor_holder"], {
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

  convertBibTexToJson(bibtex) {
    const json =
      console.log(bibFile);
    return json
  }

  importJson() {
    const options = { properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] }
    remote.dialog.showOpenDialog(options).then(result => {
      if (!result.canceled) {
        const path = result.filePaths[0];
        const json = fs.readFileSync(path, 'utf8').toString();
        this.loadDatas(JSON.parse(json), path)
      }
    }).catch(err => {
      console.log(err)
    })
  }

  importBibTex() {
    const options = { properties: ['openFile'], filters: [{ name: 'BibTex', extensions: ['bib'] }] }
    remote.dialog.showOpenDialog(options).then(result => {
      if (!result.canceled) {
        const path = result.filePaths[0];
        const bibtex = fs.readFileSync(path, 'utf8').toString();
        const json = bibtexParse.entries(bibtex);
        this.loadDatas(json, path);
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

  // handleResize(index) {
  //   (e, { size }) => {
  //     this.setState(({ columns }) => {
  //       const nextColumns = [...columns];
  //       nextColumns[index] = {
  //         ...nextColumns[index],
  //         width: size.width,
  //       };
  //       return { columns: nextColumns };
  //     });
  //   }
  // };

  addAttachment(rowKey, path) {
    const { data } = this.state;
    for (const row of data) {
      if (row.id = rowKey) {
        row.attachment.push({ name: "", path: path });
        break;
      }
    }
    this.setState({ data });
  }

  tooltipButtonImportJson() {
    const lines = [{ id: "...", "...": "..." }, { id: "...", "...": "..." }, {}, {}]
    return (
      <div>
        <div>Le format du Json importé doit être le suivant:</div>
        <Divider style={{ marginTop: "10px", marginBottom: "10px" }} />
        <div><pre style={{ color: "white" }}>{JSON.stringify(lines, null, 2)}</pre></div>
      </div>
    )
  }

  tooltipButtonImportJsonBib() {
    return (
      <div>
        <div>Le format du dossier Bibliothèque est de la forme:</div>
        <Divider style={{ marginTop: "10px", marginBottom: "10px" }} />
        <div><i className="far fa-folder marginRight10" />files</div>
        <div><i className="far fa-file marginRight10" />metadata.json</div>
      </div>
    )
  }

  render() {

    const { data, selectedRow, selectedIndex, path } = this.state;
    const nonExpandable = data ? data.filter(el => !el.attachment || el.attachment.length === 0).map(el => el.id) : [];

    let { columns } = this.state;

    // if (columns) {
    //   columns = columns.map((col, index) => ({
    //     ...col,
    //     onHeaderCell: column => ({
    //       width: column.width,
    //       onResize: this.handleResize(index),
    //     }),
    //   }));
    // }

    return (
      <React.Fragment>
        <div >
          <Button type="primary" className="menu btn-sm" hidden={!data} onClick={() => this.saveJson()} ><i className="far fa-save marginRight10" />Save</Button>
          <Tooltip placement="topLeft" title={this.tooltipButtonImportJson}>
            <Button type="primary" className="menu btn-sm" onClick={() => this.importJson()} ><i className="far fa-file marginRight10" />Import JSON (meta)</Button>
          </Tooltip>
          <Button type="primary" className="menu btn-sm" onClick={() => this.importBibTex()} ><i className="far fa-file marginRight10" />Import BibTex (meta)</Button>
          <Tooltip placement="topLeft" title={this.tooltipButtonImportJsonBib}>
            <Button type="primary" className="menu btn-sm" onClick={() => this.importJsonBib()} ><i className="far fa-folder marginRight10" />Import JSON BIB (meta + files)</Button>
          </Tooltip>
          <Button type="primary" className="menu btn-sm" hidden={!data} onClick={() => this.exportJson()} ><i className="far fa-file marginRight10" />Export JSON (meta)</Button>
          <Button type="primary" className="menu btn-sm" hidden={!data} onClick={() => this.exportJsonBib()} ><i className="far fa-folder marginRight10" />Export JSON BIB (meta + files)</Button>
        </div>
        <Divider style={{ marginTop: "5px", marginBottom: "0px" }} />
        <SplitPane split="vertical" primary="first" minSize={300} defaultSize={'75%'} maxSize={-400}>
          <Pane className="pane1" style={{ height: '100%' }}>
            {data ?
              <div>
                <div style={{ marginLeft: "10px", marginTop: "10px" }}>
                  <Tag color="#008B8B">{path}</Tag>
                  <Tag color="#BDB76B">rows: {data.length}</Tag>
                  <Tag color="#8FBC8F">columns: {columns.length}</Tag>
                </div>
                <Divider style={{ marginTop: "10px", marginBottom: "10px" }} />
                <div className="antdTable" >
                  <Table
                    dataSource={data}
                    columns={columns}
                    pagination={false}
                    //components={{ header: { cell: ResizeableTitle } }}
                    rowExpandable={(row) => !nonExpandable.includes(row.id)}
                    onRow={(row, rowIndex) => ({
                      onClick: () => { this.onRowEdit(row, rowIndex) }
                    })}
                    rowSelection={{ selectedRowKeys: [selectedRow.key] }}
                    size="small"
                    expandedRowRender={(row) => { return (<DndProvider backend={HTML5Backend}><BSTable addAttachment={this.addAttachment.bind(this)} row={row} /></DndProvider>) }}
                  />
                </div>
              </div>
              : <div />}
          </Pane>
          <Pane className="pane2">
            <div hidden={!selectedIndex}>
              <Button type="primary" className="save btn-sm" onClick={() => this.saveJsonDoc()} ><i className="far fa-save marginRight10" />Save</Button>
              <div ref="editor_holder" />
            </div>
          </Pane>
        </SplitPane>
      </React.Fragment >
    )
  }
}


export default App
