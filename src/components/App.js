import './App.css';
import 'bootstrap/dist/css/bootstrap.css';
import 'antd/dist/antd.less';
import { SearchOutlined } from '@ant-design/icons';

import React, { Component } from 'react';
import { remote, shell } from 'electron';

import SplitPane, { Pane } from 'react-split-pane';
import { JSONEditor } from '@json-editor/json-editor';
import { DndProvider } from 'react-dnd';
import Highlighter from 'react-highlight-words';
import HTML5Backend from 'react-dnd-html5-backend';
import { Table, notification, Button, Tag, Divider, Tooltip, Input } from 'antd';
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
      selectedIndex: undefined,
      searchText: '',
      searchedColumn: '',
      currentPath: []
    }
  }

  componentDidMount() {
    document.addEventListener("keydown", this.onKeyPress.bind(this), false);
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.onKeyPress.bind(this), false);
  }

  getColumnSearchProps(dataIndex) {
    return ({
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
        <div style={{ padding: 8 }}>
          <Input
            ref={node => {
              this.searchInput = node;
            }}
            placeholder={`Search ${dataIndex}`}
            value={selectedKeys[0]}
            onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => this.handleSearch(selectedKeys, confirm, dataIndex)}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <Button
            type="primary"
            onClick={() => this.handleSearch(selectedKeys, confirm, dataIndex)}
            icon={<SearchOutlined />}
            size="small"
            style={{ width: 90, marginRight: 8 }}
          >
            Search
        </Button>
          <Button onClick={() => this.handleReset(clearFilters)} size="small" style={{ width: 90 }}>
            Reset
        </Button>
        </div>
      ),
      filterIcon: filtered => <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />,
      onFilter: (value, record) =>
        record[dataIndex]
          .toString()
          .toLowerCase()
          .includes(value.toLowerCase()),
      onFilterDropdownVisibleChange: visible => {
        if (visible) {
          setTimeout(() => this.searchInput.select());
        }
      },
      render: text =>
        this.state.searchedColumn === dataIndex ? (
          <Highlighter
            highlightStyle={{ backgroundColor: '#ffc069', padding: 0 }}
            searchWords={[this.state.searchText]}
            autoEscape
            textToHighlight={text.toString()}
          />
        ) : (
            text
          ),
    })
  };

  handleSearch(selectedKeys, confirm, dataIndex) {
    confirm();
    this.setState({
      searchText: selectedKeys[0],
      searchedColumn: dataIndex,
    });
  };

  handleReset(clearFilters) {
    clearFilters();
    this.setState({ searchText: '' });
  };

  computeColumns(data) {
    let columns = [];
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
        let column = {
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
        }
        if (!(column.dataIndex === 'id')) { column = Object.assign(column, this.getColumnSearchProps(key)) }
        columns.push(column);
        flatKeys.push(key);
      }
    }
    return columns
  }

  loadDatas(data, path) {
    if (Array.isArray(data)) {
      if (this.state.data) { data = [...this.state.data, ...data]; }
      const columns = this.computeColumns(data);
      data = data.map((el, i) => Object.assign(el, { key: i }));
      notification.success({ placement: "bottomLeft", message: "Données importées!", description: "Les données ont été importées avec succès", duration: 4 })
      this.setState({ columns: columns, data: data, currentPath: [...this.state.currentPath, path] });
    } else {
      notification.error({ placement: "bottomLeft", message: "ERREUR", description: "Le fichier importé doit être un tableau d'objets JSON", duration: 4 })
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
    this.setState({ selectedRow: row, selectedIndex: rowIndex });
  }

  clear() {
    this.setState({
      data: undefined,
      columns: undefined,
      selectedRow: {},
      selectedIndex: undefined,
      currentPath: []
    })
  }

  importJson() {
    const options = { properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] }
    remote.dialog.showOpenDialog(options).then(result => {
      if (!result.canceled) {
        const path = result.filePaths[0];
        const data = JSON.parse(fs.readFileSync(path, 'utf8').toString());
        this.loadDatas(data, path);
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
        const data = bibtexParse.entries(bibtex);
        this.loadDatas(data, path);
      }
    }).catch(err => {
      console.log(err)
    })
  }

  importJsonBib() {
    const options = { properties: ['openDirectory'], filters: [{ name: 'All Files', extensions: ['*'] }] }
    remote.dialog.showOpenDialog(options).then(result => {
      if (!result.canceled) {
        const jsonBibPath = result.filePaths[0];
        const jsonBibMetadataPath = jsonBibPath + "\\metadata.json";
        const jsonBibFilesPath = jsonBibPath + "\\files";
        if (!fs.existsSync(jsonBibMetadataPath)) {
          notification.error({ placement: "bottomLeft", message: "Erreur d'import", description: "La structure de la bibliothèque est incorrecte.\nLe chemin: " + jsonBibMetadataPath + " n'existe pas.", duration: 4 });
          return
        }
        if (!fs.existsSync(jsonBibFilesPath)) {
          notification.error({ placement: "bottomLeft", message: "Erreur d'import", description: "La structure de la bibliothèque est incorrecte.\nLe chemin: " + jsonBibFilesPath + " n'existe pas.", duration: 4 });
          return
        }
        const metadata = JSON.parse(fs.readFileSync(jsonBibMetadataPath, 'utf8').toString());
        for (const data of metadata) {
          const attachments = data.attachment;
          if (attachments && Array.isArray(attachments) && attachments.length > 0) {
            for (const attachment of attachments) {
              attachment.path = jsonBibPath + "\\" + attachment.path;
            }
          }
        }
        this.loadDatas(metadata, jsonBibPath);
      }
    }).catch(err => {
      console.log(err)
    })
  }

  exportFile(data, jsonPath) {
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 4), 'utf8');
  }

  exportDir(data, jsonBibPath) {
    fs.rmdirSync(jsonBibPath, { recursive: true });
    fs.mkdirSync(jsonBibPath);
    const jsonBibFilesPath = jsonBibPath + "\\files";
    const jsonBibMetadataPath = jsonBibPath + "\\metadata.json";
    fs.mkdirSync(jsonBibFilesPath);
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
  }

  exportJson() {
    const options = { filters: [{ name: 'JSON', extensions: ['json'] }] }
    remote.dialog.showSaveDialog(options).then(result => {
      if (!result.canceled) {
        this.exportFile(this.state.data, result.filePath);
        notification.success({ placement: "bottomLeft", message: "Métadonnées exportées!", description: "Métadonnées JSON exportées avec succès!", duration: 4 })
      }
    }).catch(err => {
      console.log(err)
    })
  }

  exportJsonBib() {
    const options = { filters: [{ name: 'All Files', extensions: ['*'] }] }
    remote.dialog.showSaveDialog(options).then(result => {
      if (!result.canceled) {
        this.exportDir(this.state.data, result.filePath);
        notification.success({ placement: "bottomLeft", message: "Bibliothèque exportée!", description: "Bibliothèque JSON (metadonnées + documents) exportée avec succès!", duration: 4 })
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

  save() {
    const { data, path } = this.state;
    if (fs.lstatSync(path_string).isDirectory()) {
      this.exportDir(data, path);
      notification.success({ placement: "bottomLeft", message: "Bibliothèque sauvegardée!", description: "Bibliothèque JSON (metadonnées + documents) sauvegardée avec succès!", duration: 4 })
    } else {
      this.exportFile(data, path);
      notification.success({ placement: "bottomLeft", message: "Métadonnées sauvegardées!", description: "Métadonnées JSON sauvegardées avec succès!", duration: 4 })
    }
  }

  addAttachment(path) {
    const { data, selectedIndex } = this.state;
    data[selectedIndex].attachment.push({ name: "POST-PRINT", path: path });
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

    const { data, selectedRow, selectedIndex, currentPath } = this.state;
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
          <Button type="primary" className="menu btn-sm" hidden={!data || currentPath.length > 1} onClick={() => this.save()} ><i className="far fa-save marginRight10" />Save</Button>
          <Button type="secondary" className="menu btn-sm" hidden={!data} onClick={() => this.clear()} ><i className="fas fa-broom marginRight10" />Clear</Button>
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
                  {currentPath.map((path, i) => <Tag key={i} color="#008B8B" onClick={() => shell.openItem(path)}>{path}</Tag>)}
                  <Tag color="#BDB76B">rows: {data.length}</Tag>
                  <Tag color="#8FBC8F">columns: {columns.length}</Tag>
                </div>
                <Divider style={{ marginTop: "10px", marginBottom: "10px" }} />
                <div className="antdTable" >
                  <Table
                    dataSource={data}
                    columns={columns}
                    pagination={false}
                    showSorterTooltip={false}
                    expandRowByClick={true}
                    search
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
            <div hidden={selectedIndex === undefined}>
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
