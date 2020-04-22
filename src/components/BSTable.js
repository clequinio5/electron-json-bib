import React from 'react';
import path from 'path';
import fs from 'fs';
import { shell } from 'electron';
import { Button } from 'antd';

function BSTable(props) {

    const openAttachment = (path) => {
        shell.openItem(path);
    }

    return (
        <div>
            {props.row.attachment
                .map(a => <div>
                    <Button
                        style={{ marginLeft: "35px" }}
                        onClick={() => openAttachment(a.path)}
                        disabled={!fs.existsSync(a.path)}
                        className={"btn btn-info btn-sm disable"}>{a.name + " - " + path.basename(a.path)}
                    </Button>
                </div>)
                .reduce((prev, curr) => [prev, <div style={{ height: "5px" }}></div>, curr])}
        </div>
    )
}

export default BSTable;