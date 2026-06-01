import Docker from "dockerode";

const docker = new Docker();
export const createContainer = async (sessionId: string) => {
    const container = await docker.createContainer({
        Image: 'ubuntu:latest',
        Cmd: ["sleep", "infinity"],
        Tty: true,
    });
    await container.start();
    return container.id;
}