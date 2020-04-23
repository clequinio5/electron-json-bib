import React from 'react';
import path from 'path';
import fs from 'fs';
import { useDrop } from 'react-dnd';
import { NativeTypes } from 'react-dnd-html5-backend';
import { shell } from 'electron';
import { Button } from 'antd';

function BSTable(props) {

    const openAttachment = (path) => {
        shell.openItem(path);
    }

    const drop = useDrop({
        accept: [NativeTypes.FILE],
        drop(item, monitor) {
            if (monitor) {
                const files = monitor.getItem().files;
                for (const file of files) {
                    const { path } = file;
                    props.addAttachment(props.row, path);
                }
            }
        },
        collect: monitor => ({
            isOver: monitor.isOver,
            canDrop: monitor.canDrop,
        }),
    })[1]

    return (
        <div ref={drop}>
            {props.row.attachment
                .map(a => <div>
                    <Button
                        style={{ marginLeft: "35px" }}
                        onClick={() => openAttachment(a.path)}
                        disabled={!fs.existsSync(a.path)}
                        className={"btn btn-info btn-sm disable"}>
                        <i className="fas fa-paperclip marginRight10" />
                        {a.name + " - " + path.basename(a.path)}
                    </Button>
                </div>)
                .reduce((prev, curr) => [prev, <div style={{ height: "5px" }}></div>, curr])}
        </div>
    )
}

export default BSTable;